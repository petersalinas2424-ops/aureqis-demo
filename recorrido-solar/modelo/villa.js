import * as T from './vendor/three.module.min.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {Reflector} from './vendor/Reflector.js';
import {aleatorio} from './materiales.js?v=4123164f6cc5';
import {vestirVilla} from './detalles.js?v=4123164f6cc5';

const bloque = new T.BoxGeometry(1,1,1);
const tabla = new T.CylinderGeometry(1,1,1,36);
const bola = new T.SphereGeometry(1,20,12);
const halo = new T.PlaneGeometry(1,1);

// Mallas consolidadas por material. La piedra, el suelo y el roble mantienen su escala en metros.
function taller(padre) {
  const lotes=new Map(), vertice=new T.Vector3(), normal=new T.Vector3();
  const transformacion=new T.Object3D(), normales=new T.Matrix3();
  function pieza(geo,material,x,y,z,ancho=1,alto=1,fondo=1,rx=0,ry=0,rz=0) {
    if (!lotes.has(material)) lotes.set(material,{p:[],n:[],u:[],i:[]});
    const lote=lotes.get(material), indice=lote.p.length/3;
    transformacion.position.set(x,y,z);transformacion.rotation.set(rx,ry,rz);
    transformacion.scale.set(ancho,alto,fondo);transformacion.updateMatrix();
    const mat=transformacion.matrix;normales.getNormalMatrix(mat);
    const pos=geo.attributes.position, norm=geo.attributes.normal, uv=geo.attributes.uv;
    for (let i=0;i<pos.count;i++) {
      vertice.fromBufferAttribute(pos,i).applyMatrix4(mat);normal.fromBufferAttribute(norm,i).applyMatrix3(normales).normalize();
      lote.p.push(vertice.x,vertice.y,vertice.z);lote.n.push(normal.x,normal.y,normal.z);
      if(geo===bloque && material.userData.escala) {
        const escala=material.userData.escala;
        if(Math.abs(normal.y)>.9) lote.u.push(vertice.x*escala,vertice.z*escala);
        else lote.u.push((Math.abs(normal.z)>.5 ? vertice.x : vertice.z)*escala,vertice.y*escala);
      } else lote.u.push(uv?.getX(i)??0,uv?.getY(i)??0);
    }
    const ind=geo.index;
    for(let i=0;i<(ind?ind.count:pos.count);i++) lote.i.push(indice+(ind?ind.getX(i):i));
  }
  function acabar(){
    for(const [mat,lote] of lotes) {
      const geo=new T.BufferGeometry();geo.setIndex(lote.i);
      geo.setAttribute('position',new T.Float32BufferAttribute(lote.p,3));geo.setAttribute('normal',new T.Float32BufferAttribute(lote.n,3));
      geo.setAttribute('uv',new T.Float32BufferAttribute(lote.u,2));geo.computeBoundingSphere();
      const obj=new T.Mesh(geo,mat);obj.castShadow=!(mat.transparent||mat.isMeshBasicMaterial);obj.receiveShadow=!mat.isMeshBasicMaterial;
      if(mat.transparent)obj.renderOrder=mat.userData.orden??2;
      padre.add(obj);
    }
  }
  return {pieza,acabar};
}

function crearTravertino() {
  const lienzo=document.createElement('canvas');lienzo.width=768;lienzo.height=384;
  const ctx=lienzo.getContext('2d'), datos=ctx.createImageData(768,384), rng=aleatorio(7125);
  const veta=new Float32Array(384);
  for(let y=0;y<384;y++) veta[y]=2.6*Math.sin(y*.047)+1.9*Math.sin(y*.11)+.7*Math.sin(y*.73)+1.3*rng();
  for(let y=0;y<384;y++) for(let x=0;x<768;x++) {
    const i=(y*768+x)*4, k=(384+y+Math.round(2*Math.sin(x*.00818)+Math.sin(x*.01636+y*.065)))%384;
    const q=veta[k]+(rng()-.5)*10;
    datos.data[i]=207+q;datos.data[i+1]=193+q;datos.data[i+2]=171+q;datos.data[i+3]=255;
  }
  ctx.putImageData(datos,0,0);
  for(let i=0;i<15500;i++) {
    const x=rng()*768,y=rng()*384,r=.2+Math.pow(rng(),3)*2.5;
    ctx.fillStyle=i%3?'rgba(106,89,69,.15)':'rgba(254,243,213,.29)';
    ctx.fillRect(x,y,r*(.7+2*rng()),.3+.65*rng());
  }
  const tex=new T.CanvasTexture(lienzo);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  return tex;
}

function texturaLuz(){
  const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d');
  const grad=ctx.createRadialGradient(64,64,0,64,64,63);
  for(const [p,a] of [[0,1],[.15,.82],[.35,.50],[.6,.20],[.84,.04],[1,0]])grad.addColorStop(p,'rgba(255,255,255,'+a+')');
  ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  return new T.CanvasTexture(c);
}

function aguaPiscina(padre) {
  // La lámina devuelve la vista real de los voladizos, los ventanales y las lámparas.
  const shader={
    name:'Agua de piscina',
    uniforms:{tDiffuse:{value:null},color:{value:null},textureMatrix:{value:null},noche:{value:0},avance:{value:0}},
    vertexShader:`
      uniform mat4 textureMatrix;
      varying vec4 reflejo; varying vec2 plano; varying vec3 mundo;
      void main(){
        vec4 p=vec4(position,1.);
        reflejo=textureMatrix*p; mundo=(modelMatrix*p).xyz; plano=position.xy;
        gl_Position=projectionMatrix*modelViewMatrix*p;
      }`,
    fragmentShader:`
      uniform sampler2D tDiffuse;uniform float noche,avance;
      varying vec4 reflejo;varying vec2 plano;varying vec3 mundo;
      void main(){
        vec2 q=plano;float t=avance*5.7;
        float ond=sin(q.y*8.7+sin(q.x*2.+t)*1.2+t)+.53*sin(q.x*7.1-q.y*11.2-t)+.22*sin(q.y*24.+q.x*19.+t*.6);
        vec2 uv=reflejo.xy/reflejo.w+vec2(ond*.0015,cos(q.x*4.+q.y*12.7+t)*.0009);
        vec3 r=texture2D(tDiffuse,clamp(uv,.001,.999)).rgb;
        vec3 vista=normalize(cameraPosition-mundo);
        float fresnel=.16+.65*pow(1.-clamp(vista.y,0.,1.),2.3);
        float veta=sin(q.x*5.+q.y*7.5+1.18*sin(q.y*4.+t)+t)*.5+.5;
        veta=pow(veta,15.)*(.35+.65*sin(q.y*4.4+q.x*2.1)*sin(q.y*4.4+q.x*2.1));
        vec2 junta=abs(fract(vec2(q.x+6.,q.y+1.9)*4.)-.5);
        float pieza=1.-.07*smoothstep(.47,.498,max(junta.x,junta.y));
        float orilla=smoothstep(.0,.27,min(6.-abs(q.x),1.9-abs(q.y)));
        vec3 fondo=mix(vec3(.080,.45,.41),vec3(.015,.25,.24),orilla)*(.85+veta*.38+.025*ond)*pieza;
        float focos=0.;
        for(int i=0;i<4;i++){
          vec2 d=vec2(q.x-(-4.55+float(i)*3.05),q.y-1.7);
          focos+=exp(-dot(d*vec2(1.,.64),d*vec2(1.,.64))*1.8);
        }
        vec3 fondoNoche=vec3(.005,.082,.112)+vec3(.017,.39,.43)*focos*(.79+veta*.32);
        vec3 col=mix(mix(fondo,fondoNoche,noche),r,fresnel);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  };
  const agua=new Reflector(new T.PlaneGeometry(12,3.8),{textureWidth:innerWidth<720?384:720,textureHeight:innerWidth<720?320:504,multisample:0,clipBias:.001,shader});
  agua.name='Agua y reflejo de la piscina';agua.rotation.x=-Math.PI/2;agua.position.set(-.9,.194,7.7);padre.add(agua);
  return agua;
}

export function crearVilla(padre,m) {
  const {pieza,acabar}=taller(padre), rng=aleatorio(37285);
  const cubo=(mat,x,y,z,a,h,f,ry=0)=>pieza(bloque,mat,x,y,z,a,h,f,0,ry);
  const cilindro=(mat,x,y,z,r,h)=>pieza(tabla,mat,x,y,z,r,h,r);
  const acabado=(color,extras={})=>new T.MeshStandardMaterial({color,roughness:.83,...extras});
  const definir=(nombre,mat,escala)=>{m[nombre]=mat;if(escala)mat.userData.escala=escala;return mat;};
  const cal=definir('calVilla',m.estuco.clone(),.21);cal.color.set('#f2eee4');cal.normalScale.set(.091,.091);
  const trav=definir('travertino',acabado('#fff6e9',{map:crearTravertino()}),.55);
  const metal=definir('cerrajeria',acabado('#2f332f',{metalness:.65,roughness:.35}));
  const sombra=definir('encuentros',acabado('#514b42'));
  const roble=definir('roble',m.maderaClara.clone());roble.color.set('#c59f75');
  const nogal=definir('nogal',m.madera.clone());nogal.color.set('#886c52');
  const teca=definir('teca',m.maderaClara.clone());teca.color.set('#ba9369');
  const cemento=definir('cubiertaVilla',acabado('#bbb8ab',{map:m.suelo.map,bumpMap:m.piedra.bumpMap,bumpScale:.021}),.056);
  cemento.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      '#ifdef USE_MAP\nvec3 grava=texture2D(map,vMapUv).rgb; diffuseColor.rgb*=clamp(.58+dot(grava,vec3(.333))*.62,.6,1.12);\n#endif');
  };
  const juntas=definir('juntasCaliza',acabado('#9f9888'));
  const paredInterior=definir('estucoInterior',acabado('#d1be9f',{emissive:'#ffbd79',emissiveIntensity:0}));
  const sueloInterior=definir('interiorRoble',m.maderaClara.clone(),.29);sueloInterior.color.set('#c09a70');
  const asiento=definir('tejidoMarfil',m.lino.clone());asiento.color.set('#e8dfcb');
  const cuero=definir('tejidoOliva',m.lino.clone());cuero.color.set('#7d7055');
  const roto=definir('toalla',m.lino.clone());roto.color.set('#f8f5e6');
  const alfombra=definir('trama',m.lino.clone());alfombra.color.set('#aa8b6c');
  const vidrio=definir('vidrioVilla',new T.MeshPhysicalMaterial({color:'#b9d6d0',transparent:true,opacity:.12,roughness:.06,metalness:.32,clearcoat:1,depthWrite:false,side:T.DoubleSide}));
  const lampara=definir('lineaLED',acabado('#e9d3af',{emissive:'#ffbd78',emissiveIntensity:0}));
  const pantalla=definir('linoTraslucido',acabado('#e7d4b6',{emissive:'#ffbb72',emissiveIntensity:0,side:T.DoubleSide}));
  const obra1=definir('arcillaCuadro',acabado('#8e5748')), obra2=definir('pizarraCuadro',acabado('#534e42'));
  const tierra=definir('mulch',acabado('#675c46',{map:m.suelo.map}),.05);
  const follaje=definir('matas',acabado('#81916a',{side:T.DoubleSide}));
  const lavado=definir('luzIndirecta',new T.MeshBasicMaterial({color:'#ffae62',map:texturaLuz(),transparent:true,depthWrite:false,opacity:0,blending:T.AdditiveBlending,side:T.DoubleSide}));
  lavado.userData.orden=1;
  const cojines=new Map();
  function cojin(mat,x,y,z,a,h,f,ry=0,rx=0) {
    const id=[a,h,f].join('/');if(!cojines.has(id))cojines.set(id,new RoundedBoxGeometry(a,h,f,2,Math.min(.09,h*.26)));
    pieza(cojines.get(id),mat,x,y,z,1,1,1,rx,ry);
  }
  function travertino(x1,x2,z1,z2,y) {
    cubo(trav,(x1+x2)/2,y-.09,(z1+z2)/2,x2-x1,.18,z2-z1);
    const paso=1.37;
    for(let z=z1+paso;z<z2-.02;z+=paso)cubo(juntas,(x1+x2)/2,y+.001,z,x2-x1,.003,.010);
    let fila=0;
    for(let z=z1;z<z2;z+=paso,fila++){
      const fin=Math.min(z+paso,z2);
      for(let x=x1+(fila%2===0?2.65:1.325);x<x2-.01;x+=2.65)cubo(juntas,x,y+.001,(fin+z)/2,.009,.003,fin-z);
    }
  }
  // La plataforma rodea el vaso sin cruzar su lámina.
  travertino(-10.2,9.55,-4.5,5.63,.26);
  travertino(-10.2,-7.07,5.63,9.77,.23);travertino(5.27,9.55,5.63,9.77,.23);
  travertino(-10.2,9.55,9.77,10.79,.23);
  for(const [x,z,a,f] of [[-.9,5.715,12.34,.17],[-.9,9.685,12.34,.17],[-6.985,7.7,.17,3.8],[5.185,7.7,.17,3.8]]) cubo(trav,x,.17,z,a,.18,f);
  const agua=aguaPiscina(padre);
  cubo(trav,-.33,-.022,1.1,19.57,.28,8.93);
  cubo(trav,7.36,-.038,7.7,4.15,.28,4.12);
  cubo(trav,-8.63,-.038,7.7,3.10,.28,4.12);
  padre.userData.aguaVilla=agua;
  for(let i=0;i<3;i++) cubo(trav,1.0+i*.03,.16-i*.085,11.1+i*.33,6.0-i*.16,.13,.4);

  // Planta baja abierta, de lado a lado. Todas las cristaleras tienen una habitación detrás.
  cubo(trav,-.65,.29,-.04,17.3,.14,7.5);
  cubo(sueloInterior,-.65,.366,-.05,16.95,.024,7.35);
  cubo(paredInterior,-3.97,1.81,-3.64,10.66,2.9,.27);
  cubo(paredInterior,6.58,1.81,-3.64,2.84,2.9,.27);
  frente(1.36,5.16,-3.64,.39,3.24,3);
  cubo(trav,-9.09,1.84,-.04,.42,2.96,7.42);
  cubo(trav,6.57,1.87,2.76,2.86,3.02,.31);
  cubo(cal,7.86,1.84,-.23,.28,3.01,7.54);
  cubo(trav,7.865,1.85,-3.13,.292,2.99,1.43);
  cubo(paredInterior,5.17,1.82,-.55,.21,2.94,6.34);
  cubo(sombra,-.79,3.36,.37,17.49,.13,8.14);
  cubo(cal,-.79,3.54,.37,17.62,.29,8.26);
  cubo(cemento,-.79,3.681,.37,17.52,.014,8.03);
  // La cubierta técnica se entrega a ras de la canalización sobre la fachada este.
  cubo(trav,7.40,3.39,-.23,1.2,.42,7.55);
  // Porche profundo al oeste, con plafón de roble y postes de sección mínima.
  cubo(cal,-4.86,3.51,3.52,9.02,.37,2.52);
  cubo(nogal,-4.86,3.302,3.56,8.98,.06,2.40);
  for(let x=-9.24;x<-0.35;x+=.155)cubo(roble,x,3.26,3.57,.117,.066,2.38);
  for(const x of [-9.10,-.64])cubo(metal,x,1.79,4.55,.095,2.92,.095);

  // Segunda planta más estrecha, con balcón, pasamanos de vidrio y parasol de lamas.
  cubo(sueloInterior,0,3.711,-.74,11.66,.052,5.44);
  cubo(paredInterior,2.64,5.04,-3.43,6.52,2.69,.24);
  cubo(paredInterior,-5.48,5.04,-3.43,.84,2.69,.24);
  frente(-5.06,-.62,-3.43,3.72,6.37,3);
  // Galería norte y escalones de acceso, visibles al ganar altura hacia la costa.
  cubo(nogal,1.08,3.16,-4.32,8.75,.17,1.7);
  for(let x=-3.17;x<5.4;x+=.22)cubo(roble,x,3.04,-4.32,.094,.09,1.66);
  for(const x of [-3.12,5.22])cubo(metal,x,1.62,-5.08,.085,2.89,.085);
  for(let i=0;i<3;i++)cubo(trav,1.1,.18-i*.091,-4.93-i*.58,8.81+i*.65,.14,1.19);
  for(let x=-8.6;x<-.9;x+=.18)cubo(roble,x,1.80,-3.85,.082,2.78,.15);
  for(const x of [-2.65,-.4,2.0,4.85]){
    cubo(lampara,x,3.002,-4.62,.75,.016,.032);
    cubo(lampara,x,.206,-5.52,.52,.024,.018);
  }
  for(let i=0;i<8;i++)cubo(trav,1.79+.50*Math.sin(i*.66),-.029,-7.06-i*.85,1.80,.09,.58,-.07*i);
  for(const x of [-3.08,5.82]){
    cilindro(obra1,x,.55,-5.52,.34,.72);
    for(let i=0;i<13;i++){
      const a=i*2.40;
      pieza(bola,follaje,x+.15*Math.cos(a),1.02,-5.52+.15*Math.sin(a),.07,.42,.075,.46*Math.sin(a),a,.48*Math.cos(a));
    }
  }
  // Pasamanos de acero curvado y peldaños sumergidos en el extremo oeste del vaso.
  for(const z of [7.31,7.88]){
    const curva=new T.CatmullRomCurve3([new T.Vector3(-7.33,.25,z),new T.Vector3(-7.33,.75,z),new T.Vector3(-7.09,.92,z),new T.Vector3(-6.79,.76,z),new T.Vector3(-6.77,-.55,z)]);
    const baranda=new T.TubeGeometry(curva,26,.028,8,false);pieza(baranda,metal,0,0,0);baranda.dispose();
  }
  for(const y of [-.39,-.12,.15])cubo(metal,-6.77,y,7.595,.105,.041,.57);
  cubo(trav,-5.72,5.06,-.78,.36,2.73,5.52);
  cubo(trav,5.735,5.06,-.76,.33,2.73,5.45);
  cubo(paredInterior,-.87,5.02,-.82,.16,2.63,5.3);
  cubo(trav,2.85,5.05,-2.83,1.94,2.73,1.0);
  cubo(nogal,-.02,6.43,-.49,12.28,.15,6.28);
  cubo(cal,-.02,6.617,-.49,12.46,.30,6.43);
  cubo(cemento,-.02,6.795,-.49,12.30,.07,6.30);
  for(const z of [-3.62,2.61])cubo(trav,-.02,6.83,z,12.36,.10,.10);
  for(const x of [-6.16,6.12])cubo(trav,x,6.83,-.50,.10,.10,6.23);
  for(const z of [-2.76,-1.72,-.68,.36,1.4])cubo(juntas,-.03,6.831,z,12.18,.006,.016);
  for(const x of [-4.34,.09,4.52])cubo(juntas,x,6.831,-.56,.012,.006,5.96);
  // Juntas de piedra alineadas con los cantos de forjado en la fachada del ala este.
  for(const y of [1.04,1.82,2.6]){
    cubo(juntas,6.6,y,2.921,2.75,.012,.009);cubo(juntas,5.903,y+3.06,-.77,.008,.012,5.20);
  }
  for(const x of [5.78,7.13])cubo(juntas,x,1.82,2.925,.01,2.9,.011);
  function frente(x1,x2,z,y1,y2,panos){
    const a=x2-x1,h=y2-y1;
    pieza(halo,vidrio,(x1+x2)/2,(y1+y2)/2,z,a,h,1);
    for(let i=0;i<=panos;i++)cubo(metal,x1+i*a/panos,(y1+y2)/2,z+.012,i===0||i===panos?.067:.044,h,.102);
    for(const y of [y1,y2])cubo(metal,(x1+x2)/2,y,z,a,.06,.105);
  }
  frente(-8.87,5.1,2.769,.393,3.25,7);frente(-5.51,5.56,1.746,3.765,6.41,6);
  for(const x of [-5.11,-4.52,-3.94,-3.36,-2.78]){cubo(roble,x,5.055,1.98,.091,2.70,.30,-.39);}
  for(let x=3.71;x<5.5;x+=.159)cubo(nogal,x,5.07,1.98,.063,2.61,.18,-.37);
  for(let x=5.36;x<6.40;x+=.106)cubo(nogal,x,1.83,2.958,.068,2.85,.092);
  cubo(trav,-.54,3.65,3.12,14.10,.14,2.78);
  for(let i=0;i<8;i++) {
    const x=-7.53+(i+.5)*1.759;
    pieza(halo,vidrio,x,4.18,4.44,1.748,.99,1);cubo(metal,x,3.715,4.45,1.75,.036,.058);
  }
  for(const x of [-7.55,6.48])cubo(metal,x,4.20,4.45,.035,.98,.037);
  cubo(metal,-.54,4.695,4.45,14.05,.027,.038);

  // Salón, comedor y dormitorio. Se ven a través del vidrio también en la vista nocturna.
  function sofa(x,z,ancho=2.9,piso=0){
    cubo(nogal,x,piso+.57,z,ancho-.20,.20,1.01);
    for(const lado of [-1,1]){
      cojin(asiento,x+lado*ancho*.248,piso+.77,z,ancho*.49,.31,1.02);
      cojin(asiento,x+lado*ancho*.248,piso+1.09,z-.39,ancho*.492,.59,.23,0,-.12);
      cojin(asiento,x+lado*(ancho*.5+.018),piso+.91,z,.17,.39,1.02);
    }
    cojin(cuero,x-.77,piso+1.05,z-.16,.41,.35,.16,-.16,-.25);
    cojin(roto,x+.81,piso+1.10,z-.18,.48,.43,.16,.17,-.22);
  }
  cubo(alfombra,-4.7,.392,.15,4.87,.025,3.08);
  sofa(-4.6,-.75,3.35);
  cilindro(nogal,-4.37,.55,.91,.26,.30);cilindro(trav,-4.37,.737,.91,.71,.09);
  cilindro(obra1,-4.16,.85,.92,.117,.16);cilindro(obra2,-4.47,.809,.94,.072,.064);
  cojin(cuero,-7.12,.76,.33,.83,.27,.88,-.36);
  cojin(cuero,-7.23,1.03,.07,.81,.48,.18,-.36,-.11);
  cubo(nogal,-7.11,.53,.34,.72,.21,.74,-.36);
  cubo(nogal,.56,.83,-.15,2.64,.09,1.0);
  for(const x of [-.31,1.43])cubo(nogal,x,.59,-.15,.32,.44,.73);
  for(const x of [-.29,.54,1.36])for(const z of [-.89,.58]){
    cojin(cuero,x,.65,z,.45,.10,.48);cubo(roble,x,.87,z+(z<0?-.20:.20),.425,.36,.055);
    for(const dx of [-.15,.15])for(const dz of [-.14,.14])cubo(nogal,x+dx,.53,z+dz,.032,.28,.032);
  }
  cubo(nogal,-1.45,1.40,-3.42,5.34,2.04,.24);
  for(const y of [.87,1.60,2.35])cubo(roble,-1.45,y,-3.16,5.35,.067,.42);
  for(let i=0;i<46;i++){
    const x=-3.79+rng()*4.56,y=[.91,1.64][i%2],h=.19+rng()*.2;
    cubo([obra1,asiento,nogal,obra2][i%4],x,y+h/2,-3.13,.042+rng()*.08,h,.14);
  }
  const lienzo=(x,y,z,a,h)=>{
    cubo(nogal,x,y,z,a+.065,h+.065,.069);cubo(roto,x,y,z+.04,a,h,.018);
    pieza(bola,obra1,x-.12*a,y+.03*h,z+.06,.24*a,.31*h,.006,0,0,-.42);
    pieza(bola,obra2,x+.10*a,y-.15*h,z+.069,.24*a,.17*h,.007,0,0,.21);
  };
  lienzo(-6.45,1.94,-3.46,2.25,1.58);lienzo(2.31,5.15,-3.25,1.55,1.24);
  cubo(nogal,2.45,3.95,-1.38,2.95,.42,2.31);
  cojin(asiento,2.45,4.17,-1.39,2.84,.25,2.23);
  cojin(roto,2.45,4.30,-1.21,2.86,.12,1.68);
  cubo(cuero,2.45,4.47,-2.63,3.31,1.13,.18);
  for(const x of [1.77,3.12])cojin(roto,x,4.45,-2.16,1.01,.14,.52);
  for(const x of [.57,4.31]) {
    cilindro(nogal,x,4.03,-2.10,.26,.59);cilindro(pantalla,x,4.55,-2.09,.18,.27);
  }
  sofa(-3.4,-1.27,2.31,3.36);
  // Cortinas de gasa surcadas por pliegues, con huecos para ver la profundidad interior.
  const tela=definir('voile',acabado('#d8c9b2',{side:T.DoubleSide,emissive:'#f8ab6b',emissiveIntensity:0}));
  function cortina(x,y,z,a,h){
    const g=new T.PlaneGeometry(a,h,36,7), p=g.attributes.position;
    for(let i=0;i<p.count;i++) {
      const u=g.attributes.uv.getX(i),v=g.attributes.uv.getY(i);
      p.setZ(i,Math.sin(u*34.55)*(.048+.040*(1-v))+.015*Math.cos(v*4+u*18));
    }
    g.computeVertexNormals();pieza(g,tela,x,y,z);g.dispose();
  }
  for(const x of [-8.40,-2.76,4.59])cortina(x,1.86,2.51,.72,2.74);
  for(const x of [-5.17,-1.30,5.19])cortina(x,5.055,1.48,.72,2.62);

  // Tumbonas a la derecha, alejadas de la línea visual del montaje.
  for(const z of [6.38,8.23]){
    const x=7.40;
    for(const dz of [-.32,.32])cubo(teca,x,.44,z+dz,2.09,.14,.094);
    for(const dx of [-.83,.76])for(const dz of [-.30,.30])cubo(nogal,x+dx,.35,z+dz,.086,.19,.085);
    for(let i=0;i<16;i++)cubo(teca,x-.96+i*.125,.50,z,.10,.055,.73);
    cojin(asiento,x+.21,.565,z,1.52,.11,.72);
    pieza(bloque,teca,x-.80,.71,z,.68,.074,.73,0,0,-.49);
    const rec=new RoundedBoxGeometry(.69,.10,.69,2,.032);
    pieza(rec,asiento,x-.82,.76,z,1,1,1,0,0,-.49);rec.dispose();
  }
  cilindro(trav,7.34,.46,7.30,.24,.46);
  cilindro(obra1,7.39,.724,7.3,.115,.069);cubo(roto,7.63,.63,8.23,.52,.057,.59,-.03);
  for (const x of [-5.75,-2.8,.45,3.30]) {
    cubo(lampara,x,3.285,1.79,1.06,.023,.031);
    cubo(lampara,x,6.35,1.85,1.14,.021,.030);
  }
  cubo(lampara,-4.92,3.222,4.35,7.79,.015,.026);
  for(const [x,y,z] of [[-.16,2.70,-.15],[.54,2.57,-.15],[1.22,2.72,-.15],[-6.1,2.30,-1.75]]){
    cilindro(metal,x,(3.27+y)/2,z,.009,3.27-y);
    pieza(bola,pantalla,x,y,z,.158,.173,.158);
  }
  cubo(metal,-7.44,.97,-.9,.033,1.16,.035);
  cilindro(pantalla,-7.44,1.74,-.9,.27,.33);
  for(const [x,y,z] of [[-5.95,1.56,-3.480],[.45,1.65,-3.48],[2.32,5.18,-3.26],[-3.3,5.08,-3.29]]){
    pieza(halo,lavado,x,y,z+.01,3.43,2.30,1);
  }
  for(const x of [5.40,7.57]){
    cubo(metal,x,2.32,2.966,.12,.21,.098);
    cubo(lampara,x,2.214,2.966,.09,.014,.067);
    pieza(halo,lavado,x,1.71,2.972,.66,1.26,1);
  }
  // Luz de cortesía en el pasillo técnico, útil cuando la batería ya está anocheciendo.
  cubo(metal,8.048,2.80,1.12,.085,.127,.20);
  cubo(lampara,8.065,2.733,1.12,.074,.012,.16);
  pieza(halo,lavado,8.004,1.80,1.08,2.28,2.13,1,0,Math.PI/2);
  for(const x of [-5.3,-1.4,2.35]) {
    cubo(lampara,x,.21,10.792,.24,.026,.008);
    pieza(halo,lavado,x,.015,10.95,1.3,1.44,1,-Math.PI/2);
  }
  // Jardín de gramíneas y macizos. Las matas se siembran en bandas, fuera del pavimento.
  const hierbas=new T.BufferGeometry(), p=[], ix=[];
  function macizo(x,z,radio) {
    for(let i=0;i<67;i++){
      const a=rng()*Math.PI*2,r=radio*Math.sqrt(rng()),bx=x+Math.cos(a)*r,bz=z+Math.sin(a)*r;
      const ang=a+(rng()-.5)*2.4,dx=Math.cos(ang),dz=Math.sin(ang),altura=.28+rng()*.54;
      const base=p.length/3;
      for(let j=0;j<=5;j++){
        const t=j/5,w=(1-t)*.027,rev=.42*t*t;
        const xx=bx+dx*rev,zz=bz+dz*rev,yy=.045+altura*t-.26*t*t;
        p.push(xx-dz*w,yy,zz+dx*w,xx+dz*w,yy,zz-dx*w);
        if(j<5){const k=base+j*2;ix.push(k,k+1,k+2,k+1,k+3,k+2);}
      }
    }
  }
  for(const lado of [-1,1]){
    const x=lado<0?-10.82:10.1;
    cubo(tierra,x,-.02,2.20,1.43,.12,16);
    for(let i=0;i<16;i++){
      const cx=x+(rng()-.5)*.75,cz=-4.7+i*.93,radio=.27+rng()*.25;
      if(lado<0 || cz<2.55 || cz>6.45) macizo(cx,cz,radio);
    }
  }
  for(let i=0;i<9;i++)macizo(-8.97+i*.78,11.04+rng()*.3,.26);
  // Una pradera ajardinada enlaza los bordes de piedra con el terreno de la ladera.
  const pradera=definir('cespedVilla',acabado('#d9e0b1',{map:m.lomas.map,transparent:true,vertexColors:true,depthWrite:false}),.12);
  pradera.onBeforeCompile=sh=>{
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',
      '#ifdef USE_MAP\nvec3 pasto=texture2D(map,vMapUv*.43).rgb;diffuseColor.rgb*=pasto*.93+sqrt(pasto)*.28;\n#endif');
  };
  const geoPrado=new T.PlaneGeometry(47,42,51,43);geoPrado.rotateX(-Math.PI/2);
  const vert=geoPrado.attributes.position, rgb=[];
  for(let i=0;i<vert.count;i++){
    const x=vert.getX(i),z=vert.getZ(i),rr=Math.hypot(x/20.4,z/17.3);
    const borde=rr+.034*Math.sin(x*.34+z*.14)+.045*Math.cos(z*.37-x*.12);
    vert.setY(i,-.118+.020*Math.sin(z*.41)*Math.sin(x*.48));
    const tono=.92+.040*Math.sin(x*.68+z*.22)+.035*Math.cos(z*.76);
    rgb.push(tono,tono+.024,tono-.015,1-T.MathUtils.smoothstep(borde,.46,.90));
  }
  geoPrado.setAttribute('color',new T.Float32BufferAttribute(rgb,4));
  const cesped=new T.Mesh(geoPrado,pradera);cesped.position.z=2;cesped.receiveShadow=true;cesped.renderOrder=-2;cesped.userData.paisajismo=true;padre.add(cesped);
  const grava=definir('gravaJardin',acabado('#e0cfb3',{map:m.suelo.map,roughness:.99}));
  grava.onBeforeCompile=sh=>{
    sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',
      '#ifdef USE_MAP\nvec3 arido=texture2D(map,vMapUv).rgb;diffuseColor.rgb*=clamp(.34+dot(arido,vec3(.333))*1.45,.39,1.12);\n#endif');
  };
  function parche(material,contorno,altura) {
    const curva=new T.Shape();
    contorno(curva);
    const geo=new T.ShapeGeometry(curva,22);geo.rotateX(Math.PI/2);
    const puntos=geo.attributes.position,uv=geo.attributes.uv;
    for(let j=0;j<puntos.count;j++)uv.setXY(j,puntos.getX(j)*.053,puntos.getZ(j)*.053);
    material.side=T.DoubleSide;
    pieza(geo,material,0,altura,0);geo.dispose();
  }
  parche(grava,s=>{
    s.moveTo(-13.45,-3.3);s.bezierCurveTo(-14.65,1.9,-12.43,5.8,-13.32,9.8);
    s.bezierCurveTo(-14.1,14.7,-9.53,14.25,-6.97,13.10);s.bezierCurveTo(-4.3,11.91,-3.34,12.22,-1.84,11.93);
    s.lineTo(-1.84,10.65);s.lineTo(-10.08,10.65);s.lineTo(-10.08,-3.3);s.closePath();
  },.008);
  parche(grava,s=>{
    s.moveTo(4.09,10.61);s.lineTo(4.09,11.45);s.bezierCurveTo(6.58,11.73,6.32,13.48,9.55,13.48);
    s.bezierCurveTo(13.7,13.15,11.84,9.62,13.02,7.73);s.bezierCurveTo(15.2,4.28,13.01,.13,12.74,-4.9);
    s.lineTo(9.43,-4.9);s.lineTo(9.43,10.6);s.closePath();
  },.008);
  // El paso de losas arranca justo donde terminan los tres peldaños.
  for(let i=0;i<9;i++) {
    const x=1.04+Math.sin(i*.245)*1.39, z=12.26+i*.77;
    cubo(trav,x,-.022,z,1.91-i*.037,.10,.57-i*.014,.018*Math.cos(i*.8));
  }
  const mata1=definir('santolina',m.hojas.clone());mata1.color.set('#c1c6aa');
  const mata2=definir('romero',m.hojas.clone());mata2.color.set('#8fa385');
  const mata3=definir('lentisco',m.hojas.clone());mata3.color.set('#9bad81');
  const piedra=definir('rocaJardin',m.caliza.clone());piedra.color.set('#aea28a');
  const brote=new T.IcosahedronGeometry(1,1), rocalla=new T.IcosahedronGeometry(1,1);
  const punta=new T.ConeGeometry(1,1,4);
  const muestras=[[-12.5,1,1.12],[-11.34,2.3,.70],[-11.2,6.22,.78],[-12.25,7.21,1.16],[-11.67,9.35,.78],
    [-11.45,11.36,1.10],[-9.74,12.27,.9],[-8.21,12.05,.75],[-5.51,11.46,.64],[-3.56,11.20,.48],
    [5.08,11.11,.59],[7.19,11.72,.77],[9.47,12.10,.81],[11.22,10.70,1.20],[10.92,8.46,.77],
    [12.20,7.31,.96],[12.78,6.81,.55],[11.21,2.16,.88],[10.93,.9,.57],[10.72,-2.40,1.05]];
  for(let i=0;i<muestras.length;i++){
    const [x,z,r]=muestras[i];const mat=[mata1,mata2,mata3][i%3];
    for(let b=0;b<33;b++){
      const a=rng()*6.28,s=Math.sqrt(rng()),xx=x+Math.cos(a)*s*r*.75,zz=z+Math.sin(a)*s*r*.64;
      const altura=r*(.24+Math.sqrt(1-s*s)*.27), tam=r*(.13+.13*rng());
      const giro=rng()*6.28, balance=(rng()-.5)*.72;
      pieza(halo,mat,xx,altura,zz,tam*2.72,tam*2.47,1,balance,giro,.26);
      pieza(halo,mat,xx,altura,zz,tam*2.65,tam*2.57,1,.28,giro+1.57,-.16);
      if(i%3===0)pieza(punta,follaje,xx,altura+tam,zz,tam*.18,tam*.69,tam*.18,.22,a,-.17);
    }
    macizo(x-r*.73,z+.21,.22+r*.20);
    for(let j=0;j<4;j++){
      const a=rng()*6.28,l=.11+rng()*.17;
      pieza(rocalla,piedra,x+Math.cos(a)*(r*.93),.032,z+Math.sin(a)*(r*.89),l,l*.41,l*.7,0,a,-.09);
    }
  }
  // Cipreses estrechos detrás de las copas redondas, con silueta y tonalidad propias.
  const cipres=definir('cipres',acabado('#3e5541',{roughness:1,flatShading:true}));
  for(const [x,z,h] of [[-11.55,-1.04,5.46],[-12.26,-2.30,4.52],[-9.4,-7.55,5.4],[9.98,-6.01,5.18],[11.52,-5.12,4.15]]) {
    cilindro(nogal,x,.38,z,h*.017,.76);
    for(let nivel=0;nivel<12;nivel++) {
      const f=nivel/12, radio=h*.102*Math.pow(Math.sin(Math.PI*(.28+f*.72)),.56);
      for(let q=0;q<8;q++){
        const a=q*.785+nivel*1.12,r=radio*(.45+.17*rng());
        pieza(brote,cipres,x+Math.cos(a)*r,.57+h*.085*nivel,z+Math.sin(a)*r,radio*.57,h*.14,radio*.55,0,a,.04);
      }
    }
  }
  for(const [x,z] of [[-12.2,7.65],[-9.9,12.56],[-4.54,11.62],[6.3,11.95],[10.87,9.5],[11.54,2.36]]){
    cubo(metal,x,.26,z,.065,.52,.065);cubo(lampara,x,.489,z,.073,.044,.073);
    pieza(halo,lavado,x,.022,z+.11,1.26,1.51,1,-Math.PI/2);
  }
  hierbas.setAttribute('position',new T.Float32BufferAttribute(p,3));hierbas.setIndex(ix);hierbas.computeVertexNormals();
  pieza(hierbas,follaje,0,0,0);hierbas.dispose();
  acabar();for(const g of cojines.values())g.dispose();
  const mobiliario=new T.Group(), detalle=taller(mobiliario);
  const piezaDetalle=detalle.pieza;
  const cajaDetalle=(mat,x,y,z,a,h,f,giro=0)=>piezaDetalle(bloque,mat,x,y,z,a,h,f,0,giro);
  const redondoDetalle=(mat,x,y,z,r,h)=>piezaDetalle(tabla,mat,x,y,z,r,h,r);
  const vela=acabado('#ffde98',{emissive:'#ffad4d'});
  const manta=m.lino.clone();manta.color.set('#aa694d');manta.side=T.DoubleSide;
  vestirVilla(piezaDetalle,cajaDetalle,redondoDetalle,bola,{
    teca:teca.clone(),gres:acabado('#b76446'),salvia:acabado('#839b8d',{side:T.DoubleSide}),
    lino:acabado('#f4e8cf',{side:T.DoubleSide}),hoja:acabado('#4b6951',{side:T.DoubleSide}),
    cobre:acabado('#9a6d45',{metalness:.65}),miel:acabado('#e8bc86'),papel:acabado('#e0cdae'),
    carbon:acabado('#423a34'),luz:vela,manta
  });
  detalle.acabar();padre.add(mobiliario);
  for(const obj of mobiliario.children)obj.userData.mobiliario=true;
  // Pocos puntos de luz con alcance físico. La luz cálida no tiñe el cielo ni toda la parcela.
  const luces=[];
  for(const [x,y,z,potencia,radio] of [[-4.97,2.35,.36,48,7.5],[1.07,2.43,.14,35,6.6],[2.52,5.38,-.25,42,7],[-3.46,5.28,-.4,29,6],[8.78,2.65,1.32,13,4.5],[-4.30,2.95,3.74,20,5.2]]){
    const foco=new T.PointLight('#ffca8e',0,radio,2);foco.position.set(x,y,z);padre.add(foco);luces.push([foco,potencia]);
  }
  padre.userData.actualizarVilla=(noche,progreso)=>{
    const v=T.MathUtils.smoothstep(noche,.04,.93);
    for(const [luz,fuerza] of luces)luz.intensity=v*fuerza;
    lampara.emissiveIntensity=.05+3.3*v;pantalla.emissiveIntensity=.04+1.9*v;
    vela.emissiveIntensity=.02+2.2*v;
    paredInterior.emissiveIntensity=.014+.15*v;tela.emissiveIntensity=.012+.12*v;
    lavado.opacity=.34*v;
    agua.material.uniforms.noche.value=noche;agua.material.uniforms.avance.value=progreso;
  };
  padre.userData.destruirVilla=()=>agua.dispose();
  padre.userData.actualizarVilla(0,0);
}
