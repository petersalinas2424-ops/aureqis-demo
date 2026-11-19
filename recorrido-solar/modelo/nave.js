import * as T from './vendor/three.module.min.js';
import {aleatorio} from './materiales.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {crearManiobra} from './maniobra.js';
import {crearPergola} from './pergola.js';
import {CORTE_MUELLES,FIN_LLEGADA,tiempoNave} from './guion.js';

const liberar = T.MathUtils.smoothstep;
const caja = () => new T.BoxGeometry(1,1,1);
const ancho = 80, fondo = 45;
const altoTecho = z => 11.82 - Math.abs(z)*.041;

function lienzo(ancho,alto,pintar) {
  const c=document.createElement('canvas');
  c.width=ancho;c.height=alto;pintar(c.getContext('2d'));
  const tex=new T.CanvasTexture(c);
  tex.colorSpace=T.SRGBColorSpace;
  tex.wrapS=tex.wrapT=T.RepeatWrapping;
  return tex;
}
function firmes() {
  const azar=aleatorio(1358);
  const textura=lienzo(512,512,ctx=>{
    const im=ctx.createImageData(512,512);
    for(let y=0;y<512;y++)for(let x=0;x<512;x++){
      const g=126+(azar()-.5)*53+4*Math.cos(x*.037)+2.7*Math.sin((x+y)*.113);
      const i=(512*y+x)*4;im.data[i]=g+2;im.data[i+1]=g+1;im.data[i+2]=g;im.data[i+3]=255;
    }
    ctx.putImageData(im,0,0);
    for(let i=0;i<24;i++){
      const x=azar()*512,y=azar()*512;
      const luz=ctx.createRadialGradient(x,y,0,x,y,42);
      luz.addColorStop(0,'rgba(79,72,53,.13)');luz.addColorStop(1,'rgba(90,88,70,0)');
      ctx.fillStyle=luz;ctx.fillRect(x-42,y-42,84,84);
    }
  });
  textura.repeat.set(15,11);return textura;
}
function rayadoSolar() {
  return lienzo(256,448,ctx=>{
    ctx.fillStyle='#536777';ctx.fillRect(0,0,256,448);
    const azar=aleatorio(8421);
    for(let fila=0;fila<12;fila++)for(let col=0;col<6;col++){
      const x=2.5+col*42,y=2.5+fila*36.95;
      const g=Math.floor(azar()*9);
      const grad=ctx.createLinearGradient(x,y,x+41,y+36);
      grad.addColorStop(0,'rgb('+(14+g)+','+(29+g)+','+(45+g)+')');
      grad.addColorStop(1,'rgb('+(25+g)+','+(42+g)+','+(57+g)+')');
      ctx.fillStyle=grad;ctx.fillRect(x,y,41,36);
      ctx.fillStyle='rgba(176,191,196,.55)';
      for(let j=1;j<6;j++)ctx.fillRect(x+j*6.8,y,.47,36);
      ctx.fillStyle='rgba(201,205,197,.23)';
      for(let j=1;j<22;j++)ctx.fillRect(x,y+j*1.64,41,.25);
    }
    ctx.strokeStyle='#a6b3b6';ctx.lineWidth=2.2;ctx.strokeRect(1.1,1.1,253.8,445.8);
  });
}
function cartel(texto,fondo,color,ancho=192,alto=96) {
  return lienzo(ancho,alto,ctx=>{
    ctx.fillStyle=fondo;ctx.fillRect(0,0,ancho,alto);
    ctx.font='600 '+Math.floor(alto*.62)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=color;ctx.fillText(texto,ancho*.5,alto*.54,ancho*.94);
  });
}

// Los componentes repetidos comparten geometría y material. La cubierta conserva
// el volumen de cada chapa y de cada módulo sin multiplicar las llamadas de dibujo.
function lotear(padre) {
  const lotes=new Map(),pivote=new T.Object3D();
  function ponerMatriz(geo,mat,matriz){
    const k=geo.uuid+mat.uuid;
    if(!lotes.has(k))lotes.set(k,{geo,mat,matrices:[]});
    lotes.get(k).matrices.push(matriz.clone());
  }
  function poner(geo,mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0) {
    pivote.position.set(x,y,z);pivote.rotation.set(rx,ry,rz);pivote.scale.set(sx,sy,sz);pivote.updateMatrix();
    ponerMatriz(geo,mat,pivote.matrix);
  }
  function terminar(){
    for(const {geo,mat,matrices} of lotes.values()){
      const malla=new T.InstancedMesh(geo,mat,matrices.length);
      matrices.forEach((m,i)=>malla.setMatrixAt(i,m));
      malla.castShadow=!mat.transparent;malla.receiveShadow=true;padre.add(malla);
    }
    lotes.clear();
  }
  return {poner,ponerMatriz,terminar};
}

function camaraAerea(camara,p,aspecto) {
  const k=liberar(p,0,1);
  const giro=T.MathUtils.lerp(.39,.69,k),dist=T.MathUtils.lerp(45,108,k);
  const focoX=T.MathUtils.lerp(-5.5,-1.2,k),focoZ=T.MathUtils.lerp(4,7.6,k);
  camara.aspect=aspecto;
  const base=T.MathUtils.lerp(39,36,k);
  const amplio=Math.max(1,Math.min(3.6,1.27/aspecto));
  camara.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(base)*.5)*amplio));
  camara.position.set(focoX+dist*Math.sin(giro),T.MathUtils.lerp(37,65.5,k),focoZ+dist*Math.cos(giro));
  camara.lookAt(focoX,T.MathUtils.lerp(10.95,5.5,k),focoZ);
  camara.updateProjectionMatrix();
  const pan=liberar(aspecto,.9,1.55);
  camara.projectionMatrix.elements[8]-=.22*pan;
  camara.projectionMatrix.elements[9]-=.32*(1-pan);
  camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();camara.updateMatrixWorld(true);
}

const corteMuelles=CORTE_MUELLES,finAereo=.465,llegada=tiempoNave(FIN_LLEGADA);

// El patio se fotografió con proyección cuadrada. Cámara y fondo comparten
// la misma ventana óptica para conservar el contacto con el suelo al reencuadrar.
function encuadrarMuelle(camara,aspecto,t,region){
  const u=1-T.MathUtils.smootherstep(t,0,1);
  const apaisado=liberar(aspecto,.62,1.4);
  const ancho=Math.min(.96,aspecto*.985,T.MathUtils.lerp(.275+.12*u+.023*Math.sin(Math.PI*u),.47+.23*u,apaisado));
  const alto=ancho/aspecto;
  const centro=.419+.137*u+.069*u*u;
  const x=T.MathUtils.clamp(centro-ancho*(.50+.17*apaisado),0,1-ancho);
  const y=T.MathUtils.clamp(.525-alto*(.34+.17*apaisado),0,1-alto);
  camara.position.set(-37.6,4.65,55.6);camara.lookAt(-20.3,2.8,32.8);
  camara.fov=78;camara.setViewOffset(1,1,x,y,ancho,alto);
  camara.updateMatrixWorld(true);region.set(x,1-y-alto,ancho,alto);
  // Apunta el eje óptico al sujeto en vez de seguirlo con el borde de un gran angular.
  const centroOptico=new T.Vector3(0,0,.25).unproject(camara);
  const campo=2*Math.atan(1/camara.projectionMatrix.elements[5]);
  camara.clearViewOffset();camara.aspect=aspecto;camara.fov=T.MathUtils.radToDeg(campo)*.97;
  camara.lookAt(centroOptico);camara.updateProjectionMatrix();camara.updateMatrixWorld(true);
}

function aproximarCubierta(camara,aspecto,t){
  camaraAerea(camara,0,aspecto);
  const u=1-T.MathUtils.smootherstep(t,0,1);
  const frente=camara.getWorldDirection(new T.Vector3());
  const azimut=Math.atan2(frente.x,frente.z)+.21*u;
  const altitud=T.MathUtils.lerp(Math.asin(frente.y),.08,u);
  camara.position.addScaledVector(new T.Vector3(16,39,58),u);
  frente.set(Math.sin(azimut)*Math.cos(altitud),Math.sin(altitud),Math.cos(azimut)*Math.cos(altitud));
  camara.lookAt(frente.add(camara.position));camara.updateMatrixWorld(true);
}

// La trayectoria desciende alrededor de la esquina delantera. El objetivo del
// último fotograma coincide, incluida su óptica, con la cámara de la maniobra.
function camaraParking(camara,aspecto,t){
  camaraAerea(camara,1,aspecto);
  const entrada=T.MathUtils.smootherstep(t,0,.38),cerca=T.MathUtils.smootherstep(t,.54,.98);
  const ojo=new T.Vector3(37.8,13.2,59.8).lerp(new T.Vector3(40.05,3.78,46.05),cerca);
  const foco=new T.Vector3(25.35,2.35,39.71).lerp(new T.Vector3(31.95,1.42,39.4),cerca);
  camara.position.lerp(ojo,entrada);
  foco.lerpVectors(new T.Vector3(-1.2,5.5,7.6),foco,entrada);
  camara.lookAt(foco);camara.updateMatrixWorld(true);
}
function crearDescenso(){
  const destino=new T.PerspectiveCamera(78,1,.18,1300),recorte=new T.Vector4();
  const ojo=new T.CubicBezierCurve3(new T.Vector3(),new T.Vector3(26,8,59),new T.Vector3(-27,11,65),new T.Vector3(-37.6,4.65,55.6));
  const foco=new T.CubicBezierCurve3(new T.Vector3(31.95,1.42,39.4),new T.Vector3(17,2.9,35),new T.Vector3(-12,3.3,29),new T.Vector3(-20.3,2.8,32.8));
  const punto=new T.Vector3();
  return (camara,aspecto,t)=>{
    const k=T.MathUtils.smootherstep(t,0,1);
    camaraParking(camara,aspecto,1);ojo.v0.copy(camara.position);
    encuadrarMuelle(destino,aspecto,0,recorte);
    destino.getWorldDirection(foco.v3).multiplyScalar(29).add(destino.position);
    ojo.getPoint(k,camara.position);camara.lookAt(foco.getPoint(k,punto));
    const proy=camara.projectionMatrix.elements,final=destino.projectionMatrix.elements;
    for(const i of [0,5,8,9])proy[i]=T.MathUtils.lerp(proy[i],final[i],k);
    camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();camara.updateMatrixWorld(true);
  };
}

function acabadoIndustrial(materiales,cargar,camara) {
  const u={mezclaNave:{value:0},fotoLista:{value:0}};
  const registros=[];
  for(const [nombre,p] of [['entrada',0],['general',finAereo]]){
    camaraAerea(camara,p/finAereo,16/9);
    const matriz=new T.Matrix4().multiplyMatrices(camara.projectionMatrix,camara.matrixWorldInverse);
    const color=cargar('nave-'+nombre),z=cargar('nave-z-'+nombre);
    color.wrapS=color.wrapT=z.wrapS=z.wrapT=T.ClampToEdgeWrapping;
    z.colorSpace=T.NoColorSpace;z.generateMipmaps=false;z.minFilter=z.magFilter=T.NearestFilter;
    registros.push({matriz,color,z});
  }
  for(const s of ['A','B']){
    u['matrizNave'+s]={value:null};u['fotoNave'+s]={value:null};u['profNave'+s]={value:null};
  }
  const vert='uniform mat4 matrizNaveA,matrizNaveB;varying vec4 tomaNaveA,tomaNaveB;varying vec3 posicionNave;';
  const pos=`
    vec4 mundoNave=vec4(transformed,1.);
    #ifdef USE_INSTANCING
      mundoNave=instanceMatrix*mundoNave;
    #endif
    mundoNave=modelMatrix*mundoNave;
    posicionNave=mundoNave.xyz;
    tomaNaveA=matrizNaveA*mundoNave;tomaNaveB=matrizNaveB*mundoNave;
  `;
  const frag=`
    varying vec4 tomaNaveA,tomaNaveB;
    varying vec3 posicionNave;
    uniform sampler2D fotoNaveA,fotoNaveB,profNaveA,profNaveB;
    uniform float mezclaNave,fotoLista;
    vec4 leerFachada(sampler2D foto,sampler2D prof,vec4 clip) {
      vec2 uv=clip.xy/max(.18,clip.w)*.5+.5;
      vec2 limite=min(uv,1.-uv);
      float borde=smoothstep(.001,.095,min(limite.x,limite.y))*step(.18,clip.w);
      vec2 partes=texture2D(prof,uv).rg;
      float distancia=dot(partes,vec2(65280.,255.))*(512./65535.);
      float desviacion=abs(clip.w-distancia);
      float margen=.15+clip.w*.0065;
      float visible=1.-smoothstep(margen,margen*3.,desviacion);
      return vec4(texture2D(foto,uv).rgb,borde*visible);
    }
  `;
  const mezcla=`
    if(fotoLista>.001) {
      vec4 a=leerFachada(fotoNaveA,profNaveA,tomaNaveA);
      vec4 b=leerFachada(fotoNaveB,profNaveB,tomaNaveB);
      vec2 peso=vec2(1.-mezclaNave,mezclaNave)*vec2(a.a,b.a);
      float total=peso.x+peso.y;
      vec3 foto=linearToOutputTexel(vec4((a.rgb*peso.x+b.rgb*peso.y)/max(.001,total),1.)).rgb;
      #if defined(USE_SHADOWMAP) && (NUM_DIR_LIGHT_SHADOWS > 0)
        DirectionalLightShadow foco=directionalLightShadows[0];
        float sombra=getShadow(directionalShadowMap[0],foco.shadowMapSize,foco.shadowIntensity,foco.shadowBias,foco.shadowRadius,vDirectionalShadowCoord[0]);
        if(receiveShadow) foto*=mix(.73,1.,sombra);
      #endif
      // En el suelo se pintarían los vehículos que estaban en la foto aérea.
      float explanada=max(smoothstep(21.,24.,posicionNave.z),1.-smoothstep(-48.,-40.,posicionNave.x));
      float zonaParking=explanada*(1.-smoothstep(.3,.9,posicionNave.y));
      gl_FragColor.rgb=mix(gl_FragColor.rgb,foto,.94*total*fotoLista*(1.-zonaParking));
    }
  `;
  for(const mat of materiales){
    if(!mat.isMeshStandardMaterial)continue;
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,u);
      shader.vertexShader=vert+'\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n'+pos);
      shader.fragmentShader=frag+'\n'+shader.fragmentShader.replace('#include <colorspace_fragment>','#include <colorspace_fragment>\n'+mezcla);
    };
    mat.customProgramCacheKey=()=>'acabado-industrial-01';
  }
  for(const [i,s] of [[0,'A'],[1,'B']]){
    const v=registros[i];
    u['matrizNave'+s].value=v.matriz;u['fotoNave'+s].value=v.color;u['profNave'+s].value=v.z;
  }
  return (p,fuerza=1)=>{
    u.fotoLista.value=registros.every(r=>r.color.image?.width && r.z.image?.width)?fuerza:0;
    u.mezclaNave.value=liberar(p/finAereo,.10,.83);
  };
}

export function crearNave(render,entorno,alCargar) {
  const escena=new T.Scene(),camara=new T.PerspectiveCamera(37,1,.18,1300);
  const geos=new Set(),mats=new Set(),texturas=new Set();
  let fuera=false;
  const cargador=new T.TextureLoader();
  const registrar=tex=>{texturas.add(tex);tex.anisotropy=Math.min(8,render.capabilities.getMaxAnisotropy());return tex;};
  function textura(nombre,rx=1,ry=1){
    const tex=cargador.load(new URL('./texturas/'+nombre+'.webp',import.meta.url).href,()=>{if(!fuera)alCargar?.();});
    registrar(tex);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(rx,ry);tex.colorSpace=T.SRGBColorSpace;
    return tex;
  }
  const geo=g=>{geos.add(g);return g;};
  const mat=(color,opciones={})=>{const m=new T.MeshStandardMaterial({color,roughness:.78,...opciones});mats.add(m);return m;};
  const base=geo(caja()),tubo=geo(new T.CylinderGeometry(1,1,1,12)),plano=geo(new T.PlaneGeometry(1,1));
  const curva=geo(new RoundedBoxGeometry(1,1,1,2,.12));
  const b=lotear(escena);
  const box=(m,x,y,z,a,h,f,rx=0,ry=0,rz=0)=>b.poner(base,m,x,y,z,a,h,f,rx,ry,rz);
  const cilindro=(m,x,y,z,r,h,rx=0,rz=0)=>b.poner(tubo,m,x,y,z,r,h,r,rx,0,rz);
  const chapa=mat('#acb7b4',{roughness:.44,metalness:.57});
  const chapaClara=mat('#d5dcd9',{roughness:.49,metalness:.45});
  const nervio=mat('#929e9e',{roughness:.52,metalness:.56});
  const fachada=mat('#9faaa8',{roughness:.58,metalness:.31});
  const gris=mat('#5f6c70',{metalness:.45,roughness:.62});
  const hormigon=mat('#b1ada3'),oscuro=mat('#283337',{roughness:.71});
  const grafito=mat('#424e50',{metalness:.34}),blanco=mat('#e0e1da');
  const vidrio=mat('#446270',{metalness:.71,roughness:.20,envMapIntensity:1.55});
  const linea=mat('#e6dfbf'),amarillo=mat('#daaa42');
  const tierra=mat('#aaa68d',{map:textura('pastizal',65,65)});
  const asfalto=mat('#9ca09f',{map:registrar(firmes()),roughness:.94});
  const hormigonPista=mat('#c5bfb1',{roughness:.89});
  escena.background=new T.Color('#d7d6c7');escena.fog=new T.FogExp2('#dad9cd',.0030);
  escena.environment=entorno || null;escena.environmentIntensity=.84;
  escena.environmentRotation.y=.45;

  // Paisaje real en la banda del horizonte. El entorno HDR alimenta metales y vidrio.
  const panorama=textura('valle-movil');
  const cieloMat=new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,fog:false,toneMapped:false,
    uniforms:{paisaje:{value:panorama},bruma:{value:escena.fog.color}},
    vertexShader:'varying vec3 rayo;void main(){rayo=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D paisaje;uniform vec3 bruma;varying vec3 rayo;
      void main(){vec3 d=normalize(rayo);float e=asin(d.y);
        vec2 uv=vec2(fract(atan(d.z,d.x)/6.2831853+.72),clamp(.551+2.*e/3.141593,.49,.99));
        gl_FragColor=vec4(mix(bruma,texture2D(paisaje,uv).rgb,smoothstep(-.035,.12,e)*.82),1.);
        #include <colorspace_fragment>
      }`
  });
  mats.add(cieloMat);
  const cielo=new T.Mesh(geo(new T.SphereGeometry(700,64,32)),cieloMat);
  cielo.rotation.y=.63;cielo.renderOrder=-9;cielo.visible=false;escena.add(cielo);
  const luz=new T.DirectionalLight('#ffe3c5',2.55);
  luz.position.set(-70,60,82);luz.target.position.set(0,2,0);luz.castShadow=true;
  luz.shadow.mapSize.set(innerWidth<720?1024:2048,innerWidth<720?1024:2048);
  Object.assign(luz.shadow.camera,{left:-81,right:81,top:74,bottom:-74,near:1,far:245});
  luz.shadow.normalBias=.046;luz.shadow.bias=-.00014;
  escena.add(luz,luz.target,new T.HemisphereLight('#d2e5f6','#ab9682',.84));

  box(tierra,0,-.32,0,1320,.45,1320);
  box(asfalto,0,-.05,5,151,.23,107);
  // Vial del polígono y sus dos entradas, al nivel de la parcela.
  box(asfalto,0,-.032,65,430,.14,9.3);
  box(asfalto,85,-.045,-16,10,.14,169);
  for(const x of [-48,47])box(asfalto,x,.023,58.2,11,.11,9.65);
  for(let x=-197;x<200;x+=9)box(linea,x,.047,65,3.25,.014,.13);
  for(let z=-94;z<59;z+=9)box(linea,85,.04,z,.13,.011,3.12);
  const seto=mat('#67735d');
  for(let x=-72;x<=72;x+=3.35){
    if(Math.abs(x+48)<5.8 || Math.abs(x-47)<5.8)continue;
    box(hormigon,x,.13,58.90,3.31,.19,.55);
    box(seto,x,.28,59.26,3.32,.48,.52);
  }
  box(hormigonPista,-8,.082,35.1,68,.055,24);
  for(let x=-43;x<29;x+=5.55)box(nervio,x,.118,34.8,.026,.012,23.4);
  for(const z of [27.8,35.8,43.8])box(nervio,-9,.121,z,67,.012,.025);
  // Marcas de maniobra pintadas en el pavimento y viales del recinto.
  for(let x=-36;x<=13;x+=8.2){
    box(linea,x,.13,34.3,.11,.01,20.8);
    for(let i=0;i<8;i++)box(linea,x+2.62,.137,26.5+i*2.23,.07,.01,.96);
  }
  for(let x=-56;x<60;x+=9)box(linea,x,.091,52.5,3.7,.015,.13);
  for(let x=-60;x<68;x+=3.2)box(hormigon,x,.21,57.7,3.14,.28,.35);
  for(let z=-42;z<52;z+=8)box(linea,53.3,.088,z,.13,.01,3.1);
  // Fachada modular y una cubierta a dos pendientes con juntas alzadas.
  box(hormigon,0,1.08,0,ancho,2.1,fondo);
  box(fachada,0,5.90,0,ancho,10.06,fondo);
  for(let x=-39.7;x<40;x+=1.07){
    box(chapaClara,x,6.02,22.54,.068,9.9,.12);
    box(nervio,x,6.01,-22.55,.068,9.9,.12);
  }
  for(let z=-22.4;z<22.4;z+=1.07){
    box(chapaClara,40.03,6,z,.12,9.9,.066);
    box(nervio,-40.03,6,z,.12,9.9,.066);
  }
  for(const lado of [-1,1]){
    const z=lado*11.35,rx=lado*Math.atan(.041);
    box(chapaClara,0,altoTecho(z)-.15,z,80.8,.33,22.91,rx);
    box(chapa,0,altoTecho(z)-.44,z,80.45,.40,22.72,rx);
    for(let x=-39.8;x<40.1;x+=.82)box(chapa,x,altoTecho(z)+.07,z,.046,.155,22.65,rx);
    box(chapa,0,10.86,lado*22.68,80.85,.42,.24);
  }
  box(blanco,0,11.88,0,80.8,.09,.44);
  for(let x=-39;x<42;x+=13)for(const z of [-22.72,22.72])cilindro(gris,x,5.35,z,.10,10.62);
  // Lucernarios longitudinales y ventilación en el pasillo de servicio junto a la cumbrera.
  const opal=mat('#cce1df',{roughness:.29,metalness:.17});
  for(const x of [-32,-16,0,16,32]){
    box(gris,x,11.92,.23,7.52,.35,1.42);
    box(opal,x,12.19,.23,7.37,.25,1.30);
    for(let a=-3.55;a<=3.6;a+=1.18)box(chapa,x+a,12.32,.23,.043,.035,1.31);
  }
  for(const x of [-36,-23,19,36])for(const z of [-20.65,20.6]){
    cilindro(nervio,x,altoTecho(z)+.36,z,.28,.72);
    cilindro(chapaClara,x,altoTecho(z)+.75,z,.42,.12);
  }

  for(let i=0;i<6;i++){
    const x=-32+i*8.2;
    box(oscuro,x,3.00,22.65,3.93,4.11,.34);
    box(gris,x,2.98,22.86,3.34,3.58,.16);
    for(let y=1.56;y<4.72;y+=.34)box(nervio,x,y,22.964,3.27,.036,.05);
    for(const lado of [-1,1]){
      box(oscuro,x+lado*1.81,2.82,22.91,.41,3.90,.62);
      cilindro(amarillo,x+lado*2.06,.68,23.68,.092,1.12);
      box(oscuro,x+lado*1.42,1.12,23.19,.31,.64,.40);
    }
    box(grafito,x,4.86,22.96,3.95,.40,.62);
    const placa=mat('#ffffff',{map:registrar(cartel('0'+(i+1),'#3e5257','#eff3ed'))});
    b.poner(plano,placa,x,6.35,22.67,1.7,.87,1);
  }
  // Un cuerpo de oficinas acristalado sirve como referencia de escala humana.
  box(hormigon,24,3.77,23.4,22.7,7.42,7.37);
  box(vidrio,24,4.28,27.14,21.88,5.74,.19);
  box(vidrio,35.40,4.30,23.9,.14,5.73,5.82);
  for(const y of [1.40,3.91,6.98])box(chapaClara,24,y,27.30,22.13,.14,.21);
  for(let x=13;x<=35.2;x+=1.84)box(gris,x,4.21,27.33,.077,5.63,.19);
  for(let z=21;z<=26.9;z+=1.82)box(gris,35.48,4.19,z,.20,5.69,.076);
  box(chapaClara,24,7.65,23.52,23.22,.47,7.91);
  box(grafito,21.35,3.22,28.4,6.2,.20,2.80);
  for(const x of [18.56,24.13])cilindro(gris,x,1.59,29.43,.07,3.10);
  box(asfalto,27,.121,39.71,32,.076,7.16);
  for(let x=12;x<43;x+=2.67)box(linea,x,.163,39.71,.085,.012,5.3);
  for(const [x,z] of [[-43,44],[4,46],[45,36],[46,-26],[-44,-34]]){
    cilindro(gris,x,4.95,z,.102,9.7);box(gris,x-.5,9.85,z,1.12,.10,.11);
    box(grafito,x-1.05,9.76,z,.74,.16,.32);
  }
  // Árboles, cultivos y otras cubiertas a distancia unen la parcela con el horizonte.
  const azar=aleatorio(572), corteza=mat('#65533d');
  const hojas=mat('#8a9b72',{map:textura('olivo-rama'),alphaTest:.48,side:T.DoubleSide});
  for(let i=0;i<160;i++){
    const x=azar()*440-220,z=azar()*290-190;
    if(Math.abs(x)<79&&z>-57&&z<68)continue;
    const tam=1.9+azar()*1.8;cilindro(corteza,x,tam*.39,z,tam*.062,tam*.82);
    for(let j=0;j<4;j++)b.poner(plano,hojas,x,tam*1.04,z,tam*1.7,tam*1.29,1,0,j*Math.PI*.25+azar()*.25);
  }
  for(const [x,z,w,d] of [[-142,-76,46,30],[18,-100,69,38],[86,-92,48,33],[-91,124,58,29]]){
    box(asfalto,x,.006,z+2,w+12,.095,d+22);
    box(fachada,x,4.6,z,w,9.1,d);box(chapaClara,x,9.25,z,w+.6,.26,d+.5);
    for(let dx=-w/2+4;dx<w/2-2;dx+=8){
      box(gris,x+dx,2.27,z+d/2+.055,3.72,4.25,.12);
      box(vidrio,x+dx,5.85,z+d/2+.075,5.11,.67,.09);
      box(chapa,x+dx,9.43,z,.065,.13,d);
      if(dx>0)box(blanco,x+dx,9.58,z-1.8,2.1,.57,1.5);
    }
    box(grafito,x,7.85,z+d/2+.11,w,.14,.13);
  }
  b.terminar();
  const acabado=acabadoIndustrial(mats,textura,camara);
  const patio=new T.Scene(),region=new T.Vector4();
  patio.environment=entorno;patio.environmentIntensity=escena.environmentIntensity;
  patio.environmentRotation.copy(escena.environmentRotation);
  const fotoMuelle=textura('nave-muelles');
  fotoMuelle.wrapS=fotoMuelle.wrapT=T.ClampToEdgeWrapping;
  const referencia=new T.PerspectiveCamera(78,1,.18,1300);
  referencia.position.set(-37.6,4.65,55.6);referencia.lookAt(-20.3,2.8,32.8);referencia.updateMatrixWorld(true);
  const placaFondo=new T.ShaderMaterial({
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{foto:{value:fotoMuelle},peso:{value:1},inversa:{value:camara.projectionMatrixInverse},
      mundo:{value:camara.matrixWorld},registro:{value:new T.Matrix4().multiplyMatrices(referencia.projectionMatrix,referencia.matrixWorldInverse)}},
    vertexShader:'varying vec2 ndc;void main(){ndc=position.xy;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 ndc;uniform sampler2D foto;uniform mat4 inversa,mundo,registro;uniform float peso;
      void main(){
        vec4 v=inversa*vec4(ndc,1.,1.);
        vec3 r=normalize(mat3(mundo)*v.xyz),ojo=mundo[3].xyz;
        float t=r.y<-.0001?max(.1,(.078-ojo.y)/r.y):2000.;
        if(r.z<-.0001){
          float fachada=(22.76-ojo.z)/r.z;
          vec3 f=ojo+fachada*r;
          if(fachada>0. && abs(f.x)<40.35 && f.y>=0. && f.y<=11.4)t=min(t,fachada);
        }
        vec4 clip=registro*vec4(ojo+r*t,1.);vec2 uv=clip.xy/max(.01,clip.w)*.5+.5;
        vec2 borde=min(uv,1.-uv);
        float valido=smoothstep(.0,.012,min(borde.x,borde.y))*step(.1,clip.w);
        gl_FragColor=vec4(texture2D(foto,clamp(uv,0.,1.)).rgb,peso*valido);
        #include <colorspace_fragment>
      }`
  });
  mats.add(placaFondo);
  const telon=new T.Scene(),decorado=new T.Mesh(geo(new T.PlaneGeometry(2,2)),placaFondo);
  decorado.frustumCulled=false;telon.add(decorado);
  const descender=crearDescenso();
  const solMuelle=new T.DirectionalLight('#ffe4c7',2.55);
  solMuelle.position.set(-69,41,89);solMuelle.target.position.set(-21,0,33);
  solMuelle.castShadow=true;solMuelle.shadow.mapSize.set(1024,1024);
  Object.assign(solMuelle.shadow.camera,{left:-38,right:38,top:29,bottom:-29,near:1,far:150});
  solMuelle.shadow.bias=-.00024;solMuelle.shadow.normalBias=.013;
  patio.add(solMuelle,solMuelle.target,new T.HemisphereLight('#d2e5f6','#ab9682',.84));
  const sombra=new T.ShadowMaterial({opacity:.39,depthWrite:false});
  mats.add(sombra);
  const suelo=new T.Mesh(geo(new T.PlaneGeometry(100,100)),sombra);
  suelo.receiveShadow=true;suelo.rotation.x=-Math.PI/2;suelo.position.set(-20,.078,35);patio.add(suelo);
  const maniobra=crearManiobra(patio,{geo,mat,textura,lotear,estacionados:[[.8,29.1,0xe9e7dc],[-52,2.5,0x995644]]});

  const celdas=registrar(rayadoSolar());
  const solar=mat('#ffffff',{map:celdas,roughness:.25,metalness:.53,envMapIntensity:.88});
  const pergola=crearPergola(escena,{geo,mat,base,plano,tubo,curva,solar,registrar,alCargar});
  const filas=16,columnas=45,n=filas*columnas;
  const placas=new T.InstancedMesh(plano,solar,n);
  const marcoSolar=mat('#9aa8aa',{roughness:.48,metalness:.58});
  const marcos=new T.InstancedMesh(base,marcoSolar,n);
  placas.castShadow=false;marcos.castShadow=true;placas.receiveShadow=marcos.receiveShadow=true;
  placas.frustumCulled=marcos.frustumCulled=false;
  for(const m of [placas,marcos]){m.instanceMatrix.setUsage(T.DynamicDrawUsage);escena.add(m);}
  const pivote=new T.Object3D(),angulo=7*Math.PI/180;
  const piezas=[];
  for(let f=0;f<filas;f++)for(let c=0;c<columnas;c++){
    const z=-18.8+f*2.40+(f>=8?1.60:0);
    const x=-35.2+c*1.52+Math.floor(c/9)*.83;
    // Remate escalonado por calle entre bloques para poder leer el montaje desde el aire.
    const inicio=.018+(f/15)*.41+(Math.floor(c/9)/4)*.17+(c%9)*.004;
    piezas.push({x,z,y:altoTecho(z)+.265,inicio});
  }
  function posicionar(p){
    let nVisibles=0;
    for(const pieza of piezas){
      if(p<=pieza.inicio)continue;
      const t=liberar(p,pieza.inicio,pieza.inicio+.182),salto=1-t;
      const y=pieza.y+salto*5.2,z=pieza.z-salto*.96;
      const giro=angulo+salto*.19;
      pivote.position.set(pieza.x,y,z);pivote.rotation.set(giro,0,0);pivote.scale.set(1.31,.105,2.20);pivote.updateMatrix();marcos.setMatrixAt(nVisibles,pivote.matrix);
      pivote.position.y+=.058*Math.cos(giro);pivote.position.z+=.058*Math.sin(giro);
      pivote.rotation.x=giro-Math.PI*.5;pivote.scale.set(1.284,2.175,1);pivote.updateMatrix();placas.setMatrixAt(nVisibles,pivote.matrix);
      nVisibles++;
    }
    marcos.count=placas.count=nVisibles;
    placas.instanceMatrix.needsUpdate=marcos.instanceMatrix.needsUpdate=true;
  }
  let ultimo=-1;
  return {
    dibujar(progreso,aspecto,tiempoManiobra=1,parking=0){
      if(fuera)return;
      const p=T.MathUtils.clamp(progreso,0,1);
      const montaje=T.MathUtils.clamp((p-llegada)/(finAereo-llegada),0,1);
      if(ultimo!==montaje){posicionar(montaje);ultimo=montaje;}
      if(camara.view?.enabled)camara.clearViewOffset();
      const descenso=T.MathUtils.clamp((p-finAereo)/(corteMuelles-finAereo),0,1);
      const fondo=fotoMuelle.image?.width?liberar(descenso,.66,.996):0;
      pergola.situar(parking);
      if(parking>0 && descenso<.00001) camaraParking(camara,aspecto,parking);
      else if(p<llegada) aproximarCubierta(camara,aspecto,p/llegada);
      else if(p<=finAereo+.000001) camaraAerea(camara,montaje,aspecto);
      else if(p<corteMuelles) descender(camara,aspecto,descenso);
      else encuadrarMuelle(camara,aspecto,tiempoManiobra,region);
      maniobra.situar(p<corteMuelles?0:tiempoManiobra);
      maniobra.mostrarEn(fondo>0?patio:escena);
      if(fondo<1){
        acabado(montaje*finAereo,(1-.86*liberar(descenso,.15,.80))*(1-.35*liberar(parking,.015,.30)));
        cielo.visible=!!panorama.image;cielo.position.copy(camara.position);
        render.render(escena,camara);
      }else render.clear();
      if(fondo>0){
        const auto=render.autoClear;
        try{
          render.autoClear=false;placaFondo.uniforms.peso.value=fondo;
          render.render(telon,camara);render.render(patio,camara);
        }finally{render.autoClear=auto;}
      }
    },
    destruir(){
      if(fuera)return;fuera=true;
      escena.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
      for(const g of geos)g.dispose();
      for(const m of mats)m.dispose();
      for(const t of texturas)t.dispose();
      patio.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
      pergola.destruir();maniobra.destruir();solMuelle.shadow.dispose();luz.shadow.dispose();
    }
  };
}
