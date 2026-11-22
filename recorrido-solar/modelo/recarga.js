import {encuadrarResidencial} from './travelling.js?v=d3fe41877940';
import {cargarVehiculo,proyectarAcabado} from './vehiculos.js?v=d3fe41877940';
import * as T from './vendor/three.module.min.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';


const V = (x,y,z) => new T.Vector3(x,y,z);
const acabado = (color, metalness = 0, roughness = .46) =>
  new T.MeshStandardMaterial({color,metalness,roughness});

function superficie(columnas,filas,punto,invertir=false) {
  const pos=[],uv=[],indices=[];
  for(let i=0;i<=columnas;i++) for(let j=0;j<=filas;j++) {
    const u=i/columnas, v=j/filas, p=punto(u,v);
    pos.push(p.x,p.y,p.z);uv.push(u,v);
    if(i===columnas || j===filas)continue;
    const a=i*(filas+1)+j, b=a+filas+1;
    if(invertir)indices.push(a,a+1,b,a+1,b+1,b);
    else indices.push(a,b,a+1,a+1,b,b+1);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();return g;
}

function ensamblar(grupo) {
  grupo.updateWorldMatrix(true,true);
  const inversa=grupo.matrixWorld.clone().invert(), lotes=new Map();
  for(const pieza of grupo.children) {
    const g=pieza.geometry, mat=pieza.material;
    if(!lotes.has(mat)) lotes.set(mat,{p:[],n:[],uv:[],i:[]});
    const lote=lotes.get(mat), base=lote.p.length/3, m=new T.Matrix4().multiplyMatrices(inversa,pieza.matrixWorld);
    const normales=new T.Matrix3().getNormalMatrix(m), p=V(0,0,0), n=V(0,0,0);
    for(let i=0;i<g.attributes.position.count;i++) {
      p.fromBufferAttribute(g.attributes.position,i).applyMatrix4(m);
      n.fromBufferAttribute(g.attributes.normal,i).applyMatrix3(normales).normalize();
      lote.p.push(p.x,p.y,p.z);lote.n.push(n.x,n.y,n.z);
      lote.uv.push(g.attributes.uv?.getX(i)??0,g.attributes.uv?.getY(i)??0);
    }
    const cantidad=g.index?.count??g.attributes.position.count;
    for(let i=0;i<cantidad;i++)lote.i.push(base+(g.index?.getX(i)??i));
  }
  const geometrias=new Set(grupo.children.map(m=>m.geometry));
  grupo.clear();
  for(const g of geometrias)g.dispose();
  for(const [mat,lote] of lotes){
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(lote.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(lote.n,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(lote.uv,2));g.setIndex(lote.i);g.computeBoundingSphere();
    const mesh=new T.Mesh(g,mat);mesh.castShadow=!mat.transparent;mesh.receiveShadow=!mat.isMeshBasicMaterial;
    if(mat.transparent)mesh.renderOrder=3;
    grupo.add(mesh);
  }
}

function texturaPantalla() {
  const c=document.createElement('canvas');c.width=384;c.height=306;
  const g=c.getContext('2d');
  g.fillStyle='#0b2021';g.fillRect(0,0,c.width,c.height);
  g.strokeStyle='#59f2bc';g.lineWidth=5;g.beginPath();g.arc(192,109,60,0,6.284);g.stroke();
  g.fillStyle='#c1ffdc';g.beginPath();g.moveTo(203,67);g.lineTo(164,115);g.lineTo(185,115);
  g.lineTo(178,151);g.lineTo(218,100);g.lineTo(198,100);g.closePath();g.fill();
  g.textAlign='center';g.fillStyle='#f1fff4';g.font='600 43px Arial';g.fillText('Cargando',192,223);
  for(let i=0;i<8;i++){g.fillStyle=i<6?'#73e6a8':'#315351';g.fillRect(90+i*26,249,19,8);}
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;
}

function sombraContacto(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const ctx=c.getContext('2d'), grad=ctx.createRadialGradient(64,64,0,64,64,62);
  grad.addColorStop(0,'rgba(13,20,23,.93)');grad.addColorStop(.58,'rgba(13,20,23,.78)');grad.addColorStop(1,'rgba(13,20,23,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;
  return new T.MeshBasicMaterial({map:tex,transparent:true,opacity:.84,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
}

function adoquines(){
  const c=document.createElement('canvas');c.width=c.height=512;
  const g=c.getContext('2d');g.fillStyle='#8e887b';g.fillRect(0,0,512,512);
  let semilla=84;
  const azar=()=>(semilla=(Math.imul(semilla,1664525)+1013904223)>>>0)/4294967296;
  for(let fila=0;fila<8;fila++)for(let col=-1;col<=4;col++){
    const tono=Math.floor(174+azar()*19);
    g.fillStyle='rgb('+tono+','+(tono-5)+','+(tono-16)+')';
    g.fillRect(col*128+(fila%2)*64+1,fila*64+1,126,62);
  }
  const datos=g.getImageData(0,0,512,512);
  for(let i=0;i<datos.data.length;i+=4){const ruido=(azar()-.5)*10;for(let j=0;j<3;j++)datos.data[i+j]+=ruido;}
  g.putImageData(datos,0,0);
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.anisotropy=4;
  return new T.MeshStandardMaterial({color:'#e1ddd2',map:tex,roughness:.94,side:T.DoubleSide});
}

export function crearRecarga(padre,carga,repintar) {
  const grupo=new T.Group();grupo.name='Vehículo eléctrico conectado en el patio';grupo.position.set(14.12,.033,1.86);
  padre.add(grupo);
  const pintura=new T.MeshPhysicalMaterial({color:'#a4b8c0',metalness:.52,roughness:.205,clearcoat:1,clearcoatRoughness:.075});
  const negro=acabado('#13191c',.38,.34), satinado=acabado('#383e40',.55,.37);
  const verde=acabado('#9ce9bc',.05,.28);verde.emissive.set('#48ffc0');verde.emissiveIntensity=.85;
  const cargadorClaro=acabado('#f1efe5',.26,.39), cable=acabado('#313539',.20,.48);
  const caucho=sombraContacto();
  const malla=(g,mat,x=0,y=0,z=0)=>{
    const p=new T.Mesh(g,mat);p.position.set(x,y,z);grupo.add(p);return p;
  };
  const caja=(mat,x,y,z,a,h,f,radio=.01)=>{
    const g=radio?new RoundedBoxGeometry(a,h,f,2,Math.min(radio,a*.45,h*.45,f*.45)):new T.BoxGeometry(a,h,f);
    return malla(g,mat,x,y,z);
  };
  const tubo=(mat,puntos,r,secciones=24)=>{
    const curva=new T.CatmullRomCurve3(puntos.map(p=>Array.isArray(p)?V(...p):p));
    return malla(new T.TubeGeometry(curva,secciones,r,8,false),mat);
  };
  function sombra(x,z,a,f){
    const s=malla(new T.PlaneGeometry(a,f),caucho,x,.008,z);s.rotation.x=-Math.PI/2;
  }
  sombra(0,0,5.18,2.29);
  const puertox=1.96, puertoy=.91, puertoz=.786;
  caja(negro,puertox,puertoy,puertoz,.196,.158,.047,.029);
  const tapa=caja(pintura,puertox-.116,puertoy+.035,puertoz+.046,.124,.154,.018,.016);tapa.rotation.y=-.85;
  malla(new T.TorusGeometry(.060,.009,10,32),verde,puertox,puertoy,puertoz+.037);
  tubo(cargadorClaro,[[puertox,puertoy,puertoz+.031],[puertox,puertoy,puertoz+.098],[puertox+.006,puertoy-.028,puertoz+.151]],.048,10);
  tubo(negro,[[puertox,puertoy-.004,puertoz+.088],[puertox+.009,puertoy-.049,puertoz+.159],[puertox+.05,puertoy-.113,puertoz+.193]],.035,12);
  const losa=acabado('#c7b8a2',0,.84);
  losa.side=T.DoubleSide;
  const entrada=(u,v)=>{
    const curvatura=T.MathUtils.smoothstep(u,.18,.96);
    return V(2.975+u*15.745,-.004-.344*T.MathUtils.smoothstep(u,.08,.68),
      -1.42*curvatura+(v-.5)*(3.17+.27*curvatura));
  };
  const pavimento=adoquines();
  function pavimentar(geometria){
    const uv=geometria.attributes.uv, pos=geometria.attributes.position;
    for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/2.40,pos.getZ(i)/2.40);
    malla(geometria,pavimento);
  }
  pavimentar(superficie(28,3,entrada,true));
  for(const orilla of [0,1]){
    const puntos=Array.from({length:23},(_,i)=>entrada(i/22,orilla));
    const perfilBorde=superficie(22,1,(u,v)=>{
      const p=entrada(u,orilla);
      p.y+=.003-v*(.13+.30*(1-T.MathUtils.smoothstep(u,.08,.78)));
      p.z+=(orilla-.5)*.13*v;return p;
    },orilla===0);
    malla(perfilBorde,losa);
    tubo(losa,puntos,.022,28);
  }
  // Baldosas a escala de la plaza. El mismo aparejo continúa bajo el pedestal.
  function solera(x,z,ancho,fondo){
    caja(losa,x,-.234,z,ancho,.46,fondo,.008);
    const tapa=superficie(1,1,(u,v)=>V(x+(u-.5)*ancho,-.003,z+(v-.5)*fondo),true);
    pavimentar(tapa);
  }
  solera(0,0,5.95,3.17);
  // El acceso discurre por +X. El pedestal tiene su propia solera en el
  // margen de la plaza, por fuera del ancho libre del camino y de las puertas.
  const poste=V(1.27,0,2.19);
  solera(poste.x,2.075,1.25,.98);
  const frente=V(.96,0,.29).normalize(), giro=Math.atan2(frente.x,frente.z);
  const sobre=(alto,espesor)=>V(poste.x+frente.x*espesor,alto,poste.z+frente.z*espesor);
  caja(negro,poste.x,.014,poste.z,.37,.036,.33,.012);
  caja(satinado,poste.x,.537,poste.z,.124,1.04,.105,.014);
  const perno=new T.CylinderGeometry(.018,.018,.012,6);
  for(const dx of [-.14,.14])for(const dz of [-.119,.119]){
    malla(perno,satinado,poste.x+dx,.037,poste.z+dz);
  }
  function cajaFrente(mat,alto,espesor,w,h,d,r){
    const c=sobre(alto,espesor);const m=caja(mat,c.x,c.y,c.z,w,h,d,r);m.rotation.y=giro;return m;
  }
  cajaFrente(negro,1.32,0,.459,.731,.18,.072);
  cajaFrente(cargadorClaro,1.32,.049,.435,.7,.14,.066);
  cajaFrente(negro,1.36,.121,.357,.434,.035,.047);
  const pantalla=new T.MeshBasicMaterial({map:texturaPantalla()});pantalla.toneMapped=false;
  const c=sobre(1.363,.141);const display=malla(new T.PlaneGeometry(.318,.252),pantalla,c.x,c.y,c.z);display.rotation.y=giro;
  cajaFrente(verde,1.121,.127,.19,.013,.008,.005);
  const origen=sobre(.981,.063);
  tubo(negro,[origen,origen.clone().add(V(.004,-.097,.018))],.037,8);
  const cuello=V(puertox+.05,puertoy-.113,puertoz+.193);
  tubo(cable,[origen.clone().add(V(.004,-.081,.018)),
    [1.42,.60,2.19],[1.51,.29,2.08],[1.66,.19,1.82],
    [1.86,.27,1.53],[2.01,.54,1.23],cuello],.018,48);
  // Un aplique local ilumina la zona de conexión sin simular faros de marcha.
  const aplique=new T.PointLight('#e2eaf2',0,6.5,2);aplique.position.set(15.65,2.85,2.21);padre.add(aplique);
  ensamblar(grupo);
  const referencia=new T.TextureLoader(carga).load(new URL('./texturas/berlina-en-carga.webp',import.meta.url).href,repintar);
  let tono,ultimaNoche=0;
  const retirarCoche=cargarVehiculo(grupo,'berlina-electrica',carga,modelo=>{
    modelo.rotation.y=-Math.PI/2;
    const materiales=new Set();
    modelo.traverse(o=>{if(o.material?.isMeshStandardMaterial)materiales.add(o.material);});
    const camara=new T.PerspectiveCamera(34,1.6,.065,170);
    encuadrarResidencial(camara,.555/.82);
    tono=proyectarAcabado(materiales,referencia,camara);
    tono.value=.08+.90*ultimaNoche;
    repintar();
  });
  function actualizar(noche,progreso){
    ultimaNoche=noche;if(tono)tono.value=.08+.90*noche;
    aplique.intensity=7.8*noche;
    verde.emissiveIntensity=.63+.68*noche+.13*Math.sin(progreso*24);
  };
  actualizar.destruir=()=>{retirarCoche();referencia.dispose();};
  return actualizar;
}
