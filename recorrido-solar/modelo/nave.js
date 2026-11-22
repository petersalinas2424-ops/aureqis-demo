import * as T from './vendor/three.module.min.js';
import {aleatorio} from './materiales.js?v=d3fe41877940';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {crearManiobra} from './maniobra.js?v=d3fe41877940';
import {crearPergola} from './pergola.js?v=d3fe41877940';
import {plantarPinos} from './pinar.js?v=d3fe41877940';
import {CORTE_MUELLES,FIN_LLEGADA,INICIO_PLACAS_NAVE,tiempoNave} from './guion.js?v=d3fe41877940';

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
  for(let x=-60;x<68;x+=3.2){
    if(Math.abs(x+48)>7 && Math.abs(x-47)>7)box(hormigon,x,.21,57.7,3.14,.28,.35);
  }
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
    if(Math.abs(z+60)<7 || Math.abs(x-85)<7 || Math.abs(z-65)<7 || Math.abs(x+90)<7)continue;
    if([[-142,-76,46,30],[18,-100,69,38],[86,-92,48,33],[-91,124,58,29]].some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+7 && Math.abs(z-cz)<d/2+12))continue;
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
  // Relieve lejano de la vega. Nace bajo el terreno llano del polígono;
  // los perfiles de las lomas se recortan a distintas distancias en la bruma.
  const relieve=geo(new T.PlaneGeometry(1040,880,112,88));
  relieve.rotateX(-Math.PI/2);
  const vertices=relieve.attributes.position,tonos=[];
  const colorLoma=new T.Color(),pastoSeco=new T.Color('#e2c992'),monteBajo=new T.Color('#879374');
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i),distancia=Math.hypot(x,z);
    const ondulacion=.50+.24*Math.sin(x*.019+z*.012)+.16*Math.sin(z*.041-x*.007)+.09*Math.cos(x*.054+z*.027);
    const desnivel=liberar(distancia,172,340)*(10+48*ondulacion);
    vertices.setY(i,desnivel-.39);
    colorLoma.copy(pastoSeco).lerp(monteBajo,ondulacion);
    tonos.push(colorLoma.r,colorLoma.g,colorLoma.b);
  }
  relieve.setAttribute('color',new T.Float32BufferAttribute(tonos,3));relieve.computeVertexNormals();
  const cerros=new T.Mesh(relieve,mat('#e1d8c6',{map:textura('pastizal',29,25),vertexColors:true,roughness:1}));
  escena.add(cerros);
  const zinc=mat('#76817d',{metalness:.47,roughness:.55});
  const bordillo=mat('#bdbab0'), pavimento=mat('#b1aba0',{roughness:.98});
  const pintura=mat('#ece7d7'), madera=mat('#986e47'), envoltura=mat('#c2c6b8');
  const tierraVegetal=mat('#675848'), ramaje=mat('#817566');
  const aciculas=mat('#d7e4ce',{map:textura('pino-rama'),alphaTest:.31,side:T.DoubleSide});
  // El vial de servicio conecta las parcelas traseras y dobla junto al almacén.
  box(asfalto,-27,-.03,-60,235,.12,8.3);
  box(asfalto,-90,-.033,1.8,8.1,.12,126);
  for(let x=-141;x<82;x+=10)box(pintura,x,.04,-60,3.25,.014,.13);
  for(let z=-51;z<62;z+=10)box(pintura,-90,.04,z,.13,.014,3.25);
  for(const [x,z,d] of [[-142,-76,30],[18,-100,38],[86,-92,33]]) {
    const borde=z+d/2, largo=-60-borde;
    if(largo>0)box(asfalto,x,.002,borde+largo/2,8.2,.10,largo);
  }
  // Depósitos y tubería de la parcela vecina. Las patas dejan ver el fondo
  // por debajo del cuerpo de acero al aproximarse a la primera cubierta.
  const aceroSatinado=mat('#d0d3ca',{metalness:.62,roughness:.46});
  const cono=geo(new T.ConeGeometry(1,1,28)), deposito=geo(new T.CylinderGeometry(1,1,1,28));
  for(const x of [-32,-25.6,-19.2]){
    const z=-94;
    for(const dx of [-1.32,1.32])for(const dz of [-1.32,1.32])
      box(zinc,x+dx,1.82,z+dz,.19,3.64,.19);
    b.poner(deposito,aceroSatinado,x,7.95,z,2.42,8.5,2.42);
    b.poner(cono,aceroSatinado,x,2.72,z,2.42,2.06,2.42,Math.PI);
    b.poner(cono,aceroSatinado,x,12.64,z,2.47,.93,2.47);
    for(const y of [3.82,5.90,8.05,10.2,12.17])
      b.poner(deposito,zinc,x,y,z,2.46,.095,2.46);
  }
  box(zinc,-18.2,10.62,-96.55,30,.20,.26);
  // Hileras de cultivo en los claros de la vega que se ven entre las cubiertas.
  const surco=mat('#8c7757',{roughness:1});
  for(let i=0;i<9;i++){
    const x=-69+i*4.6;
    box(surco,x,-.065,-138,.92,.1,48);
    for(let j=0;j<11;j++){
      const z=-160+j*4.4, h=2.1+.66*azar();
      cilindro(ramaje,x,h*.27,z,.12,h*.59);
      for(let k=0;k<4;k++)
        b.poner(plano,hojas,x+Math.cos(k)*.28,h*.87,z+Math.sin(k)*.28,h*1.24,h*.98,1,-.15,k*.79+.18*i);
    }
  }
  const pinos=[[-71,-39,6,3.3],[-74,-32,7.5,4.2],[-72,-18,6.2,3.2],
    [-64,55,5.8,3],[-56,57,4.4,2.5],[61,55,5.8,3.1],[67,52,6.5,3.4],
    [65,0,5.7,2.9],[67,-9,6.8,3.5],[68,-22,5.4,3],[-37,-51,6.9,3.9],
    [-24,-50,5.8,3.5],[-9,-51,6.3,3.1],[40,-51,6.4,3.5]];
  for(const g of plantarPinos(escena,pinos.map(([x,z,h,r])=>[x,.08,z,h,r]),ramaje,aciculas,3028))geos.add(g);
  // Cerramiento de malla desplegada galvanizada, con huecos en ambos accesos.
  const trama=registrar(lienzo(64,64,ctx=>{
    ctx.strokeStyle='#a9b0a9';ctx.lineWidth=3.3;
    for(let n=-64;n<=64;n+=32){
      ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n+64,64);ctx.stroke();
      ctx.beginPath();ctx.moveTo(n,64);ctx.lineTo(n+64,0);ctx.stroke();
    }
  }));
  trama.repeat.set(6,3);
  const mallaMetal=mat('#b0b7b2',{map:trama,alphaTest:.29,side:T.DoubleSide,metalness:.42});
  for(const [inicio,fin] of [[-72,-54],[-42,40],[54,72]]) {
    const tramos=Math.ceil((fin-inicio)/3.2),paso=(fin-inicio)/tramos;
    for(let i=0;i<=tramos;i++){
      const x=inicio+i*paso;
      box(zinc,x,1.03,58.85,.066,1.73,.066);
      if(i<tramos)b.poner(plano,mallaMetal,x+paso/2,1.03,58.85,paso,1.55,1);
    }
    box(zinc,(inicio+fin)/2,1.84,58.85,fin-inicio,.055,.055);
  }
  // Aceras y acceso a oficinas. Las jardineras enmarcan la puerta acristalada.
  box(bordillo,25,.20,30.14,24,.30,4.1);
  box(pavimento,25,.365,30.14,23.88,.045,3.96);
  for(const x of [15.2,28.4,33.7]){
    box(bordillo,x,.58,31.0,3.45,.48,.95);
    box(tierraVegetal,x,.835,31,3.23,.035,.77);
    for(let i=0;i<19;i++){
      const xx=x+(azar()-.5)*3.13,zz=31+(azar()-.5)*.52;
      const tam=.48+.30*azar();
      for(let cara=0;cara<2;cara++)b.poner(plano,hojas,xx,.86+tam*.35,zz,tam,tam,1,-.12,azar()*.7+cara*1.57,.2);
    }
  }
  // Dos olivos jóvenes dan escala a las oficinas a través de las vigas de la pérgola.
  for(const [x,h] of [[15.2,2.95],[28.4,2.47]]){
    cilindro(ramaje,x,.8+h*.28,31,.076,h*.56);
    for(let k=0;k<6;k++){
      const ang=k*2.4,xr=x+Math.cos(ang)*.35,zr=31+Math.sin(ang)*.35;
      b.poner(tubo,ramaje,(x+xr)/2,.78+h*.63,(31+zr)/2,.041,h*.34,.041,.35*Math.sin(ang),0,-.35*Math.cos(ang));
      for(let j=0;j<6;j++)
        b.poner(plano,hojas,xr+(azar()-.5)*.43,.74+h*(.78+azar()*.16),zr+(azar()-.5)*.45,1.16,1.03,1,-.30,azar()*6.28,.18);
    }
  }
  for(let i=0;i<6;i++)box(pintura,39.25,.096,30.05+i*.70,3.05,.014,.35);
  for(const x of [19.3,23.5]){
    cilindro(zinc,x,.78,31.6,.075,.82);
    cilindro(pintura,x,1.04,31.6,.077,.09);
  }
  const directorio=mat('#ffffff',{map:registrar(cartel('OFICINAS','#314540','#f1eee4',384,96))});
  b.poner(plano,directorio,21.35,3.48,29.85,3.72,.69,1);
  box(zinc,21.35,3.48,29.79,3.79,.74,.095);
  // Palés y bultos flejados en el lateral de servicio, fuera del giro de los camiones.
  for(const [x,z,h] of [[-44,3,.95],[-46,3,1.12],[-44,5.4,.77],[-46,5.4,.98],[-45,-3,1.06],[-43,-5,.85]]){
    for(const dz of [-.43,0,.43])box(madera,x,.19,z+dz,1.45,.21,.16);
    for(let k=0;k<6;k++)box(madera,x-.61+k*.244,.32,z,.215,.08,1.14);
    box(envoltura,x,.37+h/2,z,1.38,h,1.08);
    for(const dx of [-.40,.40]){
      box(zinc,x+dx,.378+h,z,.026,.014,1.10);
      box(zinc,x+dx,.37+h/2,z+.546,.026,h,.013);
    }
  }
  b.terminar();
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
  const pivote=new T.Object3D();
  const anguloCubierta=z=>Math.sign(z)*Math.atan(.041);
  // Sección abierta de aluminio. El eje longitudinal atraviesa los nervios
  // de la chapa y termina en cada pasillo entre bloques.
  const seccion=new T.Shape();
  seccion.moveTo(-.084,0);seccion.lineTo(.084,0);seccion.lineTo(.084,.12);
  seccion.lineTo(.044,.12);seccion.lineTo(.044,.075);seccion.lineTo(-.044,.075);
  seccion.lineTo(-.044,.12);seccion.lineTo(-.084,.12);seccion.closePath();
  const perfil=geo(new T.ExtrudeGeometry(seccion,{depth:1,bevelEnabled:false}));
  perfil.rotateY(Math.PI/2);perfil.translate(-.5,0,0);
  const apoyos=[],tramos=[];
  const primerPanel=bloque=>-35.2+bloque*(9*1.52+.83);
  const centroFila=f=>-18.8+f*2.40+(f>=8?1.60:0);
  const filaDetalle=12,bloqueDetalle=3,columnaDetalle=7;
  const focoCarril=new T.Vector3(primerPanel(bloqueDetalle)+columnaDetalle*1.52,altoTecho(centroFila(filaDetalle))+.49,centroFila(filaDetalle));
  const ojoDetalle=focoCarril.clone().add(new T.Vector3(3.25,2.65,4.9));
  const mirada=new T.Vector3();
  function encuadrarCarriles(p,aspecto){
    camaraAerea(camara,p,aspecto);
    const detalle=T.MathUtils.smootherstep(p,0,.19)*(1-T.MathUtils.smootherstep(p,.66,.98));
    if(detalle===0)return 0;
    const k=liberar(p,0,1);
    mirada.set(T.MathUtils.lerp(-5.5,-1.2,k),T.MathUtils.lerp(10.95,5.5,k),T.MathUtils.lerp(4,7.6,k)).lerp(focoCarril,detalle);
    camara.position.lerp(ojoDetalle,detalle);camara.lookAt(mirada);
    camara.fov=T.MathUtils.lerp(camara.fov,aspecto<.9?65:43,detalle);
    camara.updateProjectionMatrix();
    const ancho=liberar(aspecto,.9,1.55);
    camara.projectionMatrix.elements[8]-=.22*ancho;
    camara.projectionMatrix.elements[9]-=.32*(1-ancho);
    camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();camara.updateMatrixWorld(true);
    return detalle;
  }
  for(let fila=0;fila<filas;fila++)for(let bloque=0;bloque<5;bloque++){
    const x0=primerPanel(bloque)-.67,x1=primerPanel(bloque)+8*1.52+.67;
    for(const lado of [-1,1]){
      const z=centroFila(fila)+lado*.62;
      const turno=(15-fila)/15*.095+(4-bloque)/4*.081+(lado+1)*.006;
      const principal=fila===filaDetalle&&bloque===bloqueDetalle;
      const inicio=principal?(lado<0?.12:.25):.43+turno*.34;
      tramos.push({x:(x0+x1)/2,z,largo:x1-x0,inicio,fin:inicio+(principal?.17:.06)});
      const primeraJunta=Math.ceil((x0+.12+39.8)/.82);
      const ultimaJunta=Math.floor((x1-.12+39.8)/.82);
      for(let i=0;i<=5;i++){
        const junta=Math.round(T.MathUtils.lerp(primeraJunta,ultimaJunta,i/5));
        const inicioGrapa=principal?.018: .38+turno*.24;
        apoyos.push({x:-39.8+junta*.82,z,inicio:inicioGrapa+(5-i)*.004});
      }
    }
  }
  function loteEstructura(g,material,cantidad){
    const malla=new T.InstancedMesh(g,material,cantidad);
    malla.count=0;malla.frustumCulled=false;malla.castShadow=malla.receiveShadow=true;
    malla.instanceMatrix.setUsage(T.DynamicDrawUsage);escena.add(malla);return malla;
  }
  const carriles=loteEstructura(perfil,mat('#475965',{metalness:.53,roughness:.37}),tramos.length);
  const grapas=loteEstructura(base,mat('#465660',{metalness:.54,roughness:.48}),apoyos.length);
  const tornillos=loteEstructura(geo(new T.CylinderGeometry(.038,.038,.034,6)),mat('#d5d9d6',{metalness:.7,roughness:.31}),apoyos.length);
  let faseAnteriorEstructura=-1;
  function colocarEstructura(p){
    const fase=Math.min(INICIO_PLACAS_NAVE,p);
    if(fase===faseAnteriorEstructura)return;
    faseAnteriorEstructura=fase;
    grapas.count=0;carriles.count=0;tornillos.count=0;
    for(const apoyo of apoyos){
      const t=liberar(fase,apoyo.inicio,apoyo.inicio+.05);
      if(!t)continue;
      pivote.rotation.set(anguloCubierta(apoyo.z),0,0);
      pivote.position.set(apoyo.x,altoTecho(apoyo.z)+.147+.059*t,apoyo.z);
      pivote.scale.set(.19,.118*t,.42);pivote.updateMatrix();grapas.setMatrixAt(grapas.count++,pivote.matrix);
      pivote.position.y+=.059*t+.014;pivote.position.z+=.15;
      pivote.scale.setScalar(t);pivote.updateMatrix();tornillos.setMatrixAt(tornillos.count++,pivote.matrix);
    }
    for(const tramo of tramos){
      const t=liberar(fase,tramo.inicio,tramo.fin);
      if(!t)continue;
      const vuelo=1-t;
      pivote.rotation.set(anguloCubierta(tramo.z),0,.036*vuelo);
      pivote.position.set(tramo.x-4.5*vuelo,altoTecho(tramo.z)+.265+1.32*vuelo,tramo.z-.22*vuelo);
      pivote.scale.set(tramo.largo,1,1);pivote.updateMatrix();carriles.setMatrixAt(carriles.count++,pivote.matrix);
    }
    grapas.instanceMatrix.needsUpdate=carriles.instanceMatrix.needsUpdate=tornillos.instanceMatrix.needsUpdate=true;
  }
  const piezas=[];
  for(let f=0;f<filas;f++)for(let c=0;c<columnas;c++){
    const z=centroFila(f);
    const x=primerPanel(Math.floor(c/9))+(c%9)*1.52;
    // Remate escalonado por calle entre bloques para poder leer el montaje desde el aire.
    const inicio=INICIO_PLACAS_NAVE+Math.abs(f-filaDetalle)/12*.20+Math.abs(Math.floor(c/9)-bloqueDetalle)/3*.082+Math.abs(c%9-columnaDetalle)*.0023;
    piezas.push({x,z,y:altoTecho(z)+.438,angulo:anguloCubierta(z),inicio});
  }
  function posicionar(p){
    colocarEstructura(p);
    let nVisibles=0;
    for(const pieza of piezas){
      if(p<=pieza.inicio)continue;
      const t=liberar(p,pieza.inicio,pieza.inicio+.115),salto=1-t;
      const y=pieza.y+salto*5.2,z=pieza.z-salto*.96;
      const giro=pieza.angulo+salto*.19;
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
      let detalleCarriles=0;
      if(parking>0 && descenso<.00001) camaraParking(camara,aspecto,parking);
      else if(p<llegada) aproximarCubierta(camara,aspecto,p/llegada);
      else if(p<=finAereo+.000001) detalleCarriles=encuadrarCarriles(montaje,aspecto);
      else if(p<corteMuelles) descender(camara,aspecto,descenso);
      else encuadrarMuelle(camara,aspecto,tiempoManiobra,region);
      maniobra.situar(p<corteMuelles?0:tiempoManiobra);
      maniobra.mostrarEn(fondo>0?patio:escena);
      if(fondo<1){
        acabado(montaje*finAereo,(1-.9*detalleCarriles)*(1-.86*liberar(descenso,.15,.80))*(1-.35*liberar(parking,.015,.30)));
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
