import {lineaCosta} from './orilla.js?v=fafacc8c4dac';
import * as T from './vendor/three.module.min.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {aleatorio} from './materiales.js?v=fafacc8c4dac';
import {crearVilla} from './villa.js?v=fafacc8c4dac';
import {plantarPinos} from './pinar.js?v=fafacc8c4dac';

let AZAR;
const EJE_Y=new T.Vector3(0,1,0);
const CAJA=new T.BoxGeometry(1,1,1);
const INCLINACION=7*Math.PI/180;
const ALTURA_CUBIERTA=6.83;

function malla(padre,geo,mat,x=0,y=0,z=0) {
  const obj=new T.Mesh(geo,mat);obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;
  padre.add(obj);return obj;
}

function caja(padre,mat,x,y,z,sx,sy,sz) {
  const obj=malla(padre,CAJA,mat,x,y,z);
  obj.scale.set(sx,sy,sz);return obj;
}

// Una silueta física por módulo, con vidrio, juntas y marco independientes.
function moduloSolar(grupo,m) {
  caja(grupo,m.perfil,0,.019,0,1.126,.040,1.7);
  const vidrio=malla(grupo,VIDRIO,m.cristal,0,.042,0);
  vidrio.rotation.x=-Math.PI/2;
  for(const lado of [-1,1]) {
    caja(grupo,m.aluminio,lado*.556,.042,0,.013,.017,1.701);
    caja(grupo,m.aluminio,0,.042,lado*.844,1.123,.017,.012);
  }
  caja(grupo,m.junta,.29,-.019,-.56,.19,.054,.12);
}

const VIDRIO=new T.PlaneGeometry(1.097,1.67);
const PERNO=new T.CylinderGeometry(.035,.035,.020,6);
const PUNTO=new T.CylinderGeometry(.011,.011,.018,8);
const UNIDAD=new T.CylinderGeometry(1,1,1,10);
const escalon=(valor,a,b)=>T.MathUtils.smoothstep(valor,a,b);

// Agrupa el equipo móvil por material y geometría manteniendo el pivote de cada pieza.
// Esto permite mostrar 16 módulos y decenas de herrajes sin una llamada de dibujo por tornillo.
function movilidad(padre) {
  const elementos=[];
  function pieza(nombre,colocar) {
    const nodo=new T.Group();nodo.name=nombre;
    elementos.push({nodo,colocar});return nodo;
  }
  function terminar() {
    const lotes=new Map();
    for(const {nodo} of elementos) {
      nodo.updateMatrixWorld(true);
      nodo.traverse(hijo=>{
        if(!hijo.isMesh)return;
        const clave=hijo.geometry.uuid+hijo.material.uuid;
        if(!lotes.has(clave)) lotes.set(clave,{geo:hijo.geometry,mat:hijo.material,entradas:[]});
        lotes.get(clave).entradas.push({nodo,molde:hijo.matrixWorld.clone()});
      });
    }
    for(const lote of lotes.values()) {
      lote.malla=new T.InstancedMesh(lote.geo,lote.mat,lote.entradas.length);
      lote.malla.instanceMatrix.setUsage(T.DynamicDrawUsage);
      lote.malla.frustumCulled=false;lote.malla.receiveShadow=true;lote.malla.castShadow=!lote.mat.transparent;
      padre.add(lote.malla);
    }
    const temp=new T.Matrix4(), oculto=new T.Matrix4().makeScale(0,0,0);
    return p=>{
      for(const {nodo,colocar} of elementos){colocar(nodo,p);nodo.updateMatrix();}
      for(const {malla,entradas} of lotes.values()){
        for(let i=0;i<entradas.length;i++){
          const e=entradas[i];malla.setMatrixAt(i,e.nodo.visible?temp.multiplyMatrices(e.nodo.matrix,e.molde):oculto);
        }
        malla.instanceMatrix.needsUpdate=true;
      }
    };
  }
  return {pieza,terminar};
}

function caer(nodo,t,x,y,z,dx,dy,dz,giro=0) {
  nodo.visible=t>0;
  if(!nodo.visible)return;
  const vuelo=1-t;
  nodo.position.set(x+dx*vuelo,y+dy*vuelo,z+dz*vuelo);
  nodo.rotation.z=giro*vuelo;
  // El arranque evita que una pieza completa aparezca de golpe dentro del encuadre.
  const entrada=T.MathUtils.smoothstep(t,0,.045);
  nodo.scale.setScalar(entrada);
}

function fotovoltaica(padre,m) {
  const campo=new T.Group();campo.position.set(0,ALTURA_CUBIERTA,-2.70);padre.add(campo);
  const {pieza,terminar}=movilidad(campo);
  for(let fila=0;fila<2;fila++){
    const z=.95+fila*1.76;
    for(let linea=0;linea<2;linea++){
      const rz=z+(linea===0?-.49:.49), turno=fila*2+linea;
      const alto=.15+(linea===0?.12:0);
      for(let i=0;i<8;i++){
        const x=-4.12+i*1.177, comienzo=.077+turno*.007+i*.0022;
        const gancho=pieza('Anclaje al tejado',(n,p)=>caer(n,escalon(p,comienzo,comienzo+.066),x,0,rz,0,.22,0));
        caja(gancho,m.junta,0,.025,0,.22,.05,.31);
        caja(gancho,m.aluminio,-.042,alto/2,.046,.03,alto,.071);
        caja(gancho,m.aluminio,.001,alto,.046,.111,.018,.073);
        malla(gancho,PERNO,m.aluminio,.025,alto+.014,.042);
      }
      const rail=pieza('Carril ranurado',(n,p)=>{
        const t=escalon(p,.142+turno*.012,.24+turno*.009);n.visible=t>0;
        n.position.set(-4.77*(1-t),alto+.033+(1-t)*.13,rz);n.scale.set(t,1,1);
      });
      caja(rail,m.aluminio,0,0,0,9.54,.046,.083);
      caja(rail,m.chapa,0,.025,0,9.48,.005,.034);
      for(const lado of [-1,1])caja(rail,m.aluminio,0,.031,lado*.029,9.54,.014,.018);
    }
    for(let i=0;i<8;i++){
      const x=-4.12+i*1.177;
      const comienzo=.269+fila*.071+(7-i)*.0156;
      const panel=pieza('Módulo '+(fila*8+i+1),(n,p)=>{
        const t=escalon(p,comienzo,comienzo+.107);
        caer(n,t,x,.29,z,.3,2.0,.51,-.105);
        n.rotation.x=INCLINACION-(1-t)*.15;
      });
      moduloSolar(panel,m);
    }
  }
  return terminar();
}

// El equipo ocupa el paño de servicio este de la planta baja.
function acumulador(padre,m) {
  const pared=new T.Group();pared.position.set(8.01,.18,1.50);pared.rotation.y=Math.PI/2;padre.add(pared);
  const {pieza,terminar}=movilidad(pared);
  function montar(nombre,desde,hasta,x,y,z,dx,dy,dz,giro=0){
    return pieza(nombre,(n,p)=>caer(n,escalon(p,desde,hasta),x,y,z,dx,dy,dz,giro));
  }
  const forma=(x,y,z,radio)=>new RoundedBoxGeometry(x,y,z,3,radio);
  function serigrafia(nombre,ancho,alto,pintar) {
    const imagen=document.createElement('canvas');imagen.width=ancho;imagen.height=alto;
    pintar(imagen.getContext('2d'));
    const tex=new T.CanvasTexture(imagen);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
    m[nombre]=new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});
    return m[nombre];
  }
  const placaTecnica=serigrafia('placaTecnica',384,198,ctx=>{
    ctx.fillStyle='#e1e2d8';ctx.fillRect(0,0,384,198);
    ctx.fillStyle='#37403b';ctx.fillRect(0,0,384,6);ctx.font='bold 29px Arial';ctx.fillText('AUREQIS',14,42);
    ctx.font='bold 16px Arial';ctx.fillText('ALMACENAMIENTO MODULAR',14,70);
    ctx.lineWidth=1.5;ctx.strokeStyle='#7b827b';ctx.beginPath();ctx.moveTo(14,85);ctx.lineTo(365,85);ctx.stroke();
    ctx.font='15px Arial';ctx.fillText('Conexión al sistema de gestión',14,113);ctx.fillText('Módulo de corriente continua',14,137);
    ctx.strokeStyle='#626c63';ctx.lineWidth=3;ctx.strokeRect(16,157,36,20);ctx.fillRect(52,163,5,8);
    ctx.beginPath();ctx.moveTo(73,168);ctx.lineTo(97,168);ctx.moveTo(85,158);ctx.lineTo(85,178);ctx.moveTo(108,168);ctx.lineTo(134,168);ctx.stroke();
    ctx.font='bold 14px Arial';ctx.fillText('DC',154,175);
  });
  const marca=serigrafia('rotulo',384,96,ctx=>{
    ctx.fillStyle='#424e49';ctx.font='600 62px Arial';ctx.fillText('aureqis',6,65);
  });
  const pantalla=serigrafia('displayInversor',384,84,ctx=>{
    ctx.fillStyle='#283833';ctx.fillRect(0,0,384,84);ctx.fillStyle='#8eaf9b';
    ctx.font='24px monospace';ctx.fillText('FV',16,35);ctx.fillText('RED',314,35);
    ctx.strokeStyle='#8eaf9b';ctx.lineWidth=4;ctx.beginPath();
    for(let i=0;i<170;i++){const x=104+i,y=40-13*Math.sin(i*.103);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
    ctx.fillRect(17,53,54,3);ctx.fillRect(316,53,43,3);
  });
  function troncal(nombre,origen,fin,radio,inicio,final,material){
    const a=new T.Vector3(...origen),b=new T.Vector3(...fin),dir=b.clone().sub(a),largo=dir.length();
    const orientacion=new T.Quaternion().setFromUnitVectors(EJE_Y,dir.clone().normalize());
    const tubo=pieza(nombre,(n,p)=>{
      const t=escalon(p,inicio,final);n.visible=t>0;
      n.position.copy(a).addScaledVector(dir,t/2);n.quaternion.copy(orientacion);n.scale.set(radio,largo*t,radio);
    });
    malla(tubo,UNIDAD,material);
  }
  // La canalización sale de los módulos, baja por el retranqueo superior y continúa por la cubierta inferior.
  for(let k=0;k<2;k++) {
    const u=.64+k*.073,bajo=1.32+k*.074,llegada=1.07+k*.12;
    troncal('Tendido superior',[u,6.76,-4.03],[u,6.76,-2.08],.020,.542,.573,m.tubo);
    troncal('Bajada a la terraza',[u,6.76,-2.08],[u,3.48,-2.08],.021,.565,.603,m.tubo);
    troncal('Paso por el peto',[u,3.48,-2.08],[u,3.48,.074],.021,.588,.626,m.tubo);
    troncal('Canalización desde cubierta',[u,3.48,.074],[u,bajo,.074],.020,.616+k*.004,.672+k*.004,m.tubo);
    troncal('Canalización horizontal',[u,bajo,.074],[llegada,bajo,.074],.018,.644,.683,m.tubo);
    troncal('Entrada del inversor',[llegada,bajo,.074],[llegada,1.62,.074],.018,.67,.697,m.tubo);
  }
  for(let i=0;i<4;i++){
    const grapa=montar('Abrazadera',.615+i*.009,.635+i*.009,.677,3.22-i*.53,.085,0,0,.04);
    caja(grapa,m.aluminio,0,0,0,.146,.018,.034);
  }
  const anclaje=montar('Placa mural',.62,.672,1.2,1.95,.039,0,.17,.18);
  caja(anclaje,m.chapa,0,0,0,.59,.72,.042);
  for(const x of [-.25,.25])for(const y of [-.31,.31]) {
    const pin=malla(anclaje,PERNO,m.aluminio,x,y,.028);pin.rotation.x=Math.PI/2;
  }
  const inv=montar('Inversor',.649,.732,1.2,1.97,.166,.46,.17,.81,-.09);
  malla(inv,forma(.632,.838,.226,.041),m.aluminio);
  malla(inv,forma(.607,.808,.092,.036),m.bateria,0,0,.117);
  for(const x of [-.302,.302])for(let i=0;i<6;i++)caja(inv,m.chapa,x,-.28+i*.10,-.022,.039,.026,.19);
  caja(inv,m.junta,0,.084,.168,.35,.135,.018);
  caja(inv,m.pantalla,0,.10,.180,.254,.061,.012);
  malla(inv,new T.PlaneGeometry(.253,.060),pantalla,0,.10,.190);
  malla(inv,new T.PlaneGeometry(.19,.049),marca,-.115,.298,.169);
  for(const lado of [-1,1])for(const nivel of [-1,1]){
    const pin=malla(inv,PUNTO,m.aluminio,lado*.244,nivel*.333,.165);pin.rotation.x=Math.PI/2;
  }
  for(let i=0;i<10;i++)caja(inv,m.perfil,-.06+i*.014,-.232,.168,.005,.102,.012);
  for(const x of [-.15,-.015,.16]){
    malla(inv,new T.CylinderGeometry(.026,.024,.058,8),m.junta,x,-.43,-.035);
  }
  const aislador=montar('Seccionador de corriente continua',.702,.751,1.74,1.61,.106,.18,.12,.34);
  malla(aislador,forma(.225,.29,.134,.023),m.bateria);
  const mando=malla(aislador,new T.CylinderGeometry(.044,.044,.036,16),m.aislador,0,-.012,.084);mando.rotation.x=Math.PI/2;
  caja(aislador,m.aislador,0,-.012,.115,.064,.012,.026);
  const base=montar('Zócalo de batería',.727,.772,0,.162,.188,-.29,.11,.62);
  malla(base,forma(1.0,.141,.35,.029),m.chapa);
  for(const x of [-.375,.375])caja(base,m.junta,x,-.061,0,.16,.066,.22);
  const chasis=forma(1.035,.299,.356,.036),frente=forma(1.004,.287,.08,.029);
  for(let i=0;i<3;i++){
    const y=.392+i*.31,desde=.754+i*.035;
    const celda=montar('Batería · módulo '+(i+1),desde,desde+.069,0,y,.191,-.17+.07*i,.48+.11*i,.57-.06*i,-.035);
    malla(celda,chasis,m.bateria);
    caja(celda,m.chapa,0,-.141,-.008,.988,.018,.325);
    malla(celda,frente,m.bateria,0,0,.149);
    if(i===0)malla(celda,new T.PlaneGeometry(.196,.102),placaTecnica,.28,-.015,.194);
    for(const lado of [-1,1]){
      caja(celda,m.bateria,lado*.508,0,0,.025,.27,.281);
      caja(celda,m.perfil,lado*.523,.032,-.012,.011,.031,.125);
      const tornillo=malla(celda,PUNTO,m.aluminio,lado*.452,-.086,.19);tornillo.rotation.x=Math.PI/2;
    }
  }
  const cabeza=montar('Cabezal del acumulador',.853,.912,0,1.317,.191,.04,.49,.43,-.018);
  malla(cabeza,chasis,m.bateria);malla(cabeza,frente,m.bateria,0,0,.149);
  caja(cabeza,m.chapa,0,-.141,-.008,.988,.018,.325);
  for(const lado of [-1,1])caja(cabeza,m.bateria,lado*.508,0,0,.026,.27,.281);
  caja(cabeza,m.perfil,-.224,.008,.195,.369,.064,.012);
  malla(cabeza,new T.PlaneGeometry(.31,.079),marca,.24,.006,.198);
  for(let k=0;k<2;k++) {
    const y=1.12+k*.074;
    troncal('Enlace al acumulador',[1.38+k*.07,1.57,.11],[1.38+k*.07,y,.11],.016,.866,.904,m.cable);
    troncal('Retorno de acumulación',[1.38+k*.07,y,.11],[.488,y,.11],.016,.887,.926,m.cable);
  }
  const testigos=pieza('Indicadores en servicio',(n,p)=>{n.visible=p>=.917;});
  caja(testigos,m.led,-.306,1.324,.396,.118,.017,.008);
  caja(testigos,m.led,1.095,2.067,.354,.06,.012,.006);
  return terminar();
}

function olivar(padre,m) {
  const segmentos=[], hojas=[], pen=new T.Object3D();
  const agregarRama=(a,b,r)=>{
    const v=b.clone().sub(a);
    pen.position.copy(a).addScaledVector(v,.5);pen.quaternion.setFromUnitVectors(EJE_Y,v.clone().normalize());
    pen.scale.set(r,v.length(),r);pen.updateMatrix();segmentos.push(pen.matrix.clone());
  };
  const arbol=(x,z,s)=>{
    const base=new T.Vector3(x,.01,z);
    const giro=AZAR()*Math.PI*2;
    const pie=base.clone().add(new T.Vector3(-Math.sin(giro)*s*.12,.46*s,Math.cos(giro)*s*.12));
    const arranque=pie.clone().add(new T.Vector3(Math.cos(giro)*s*.23,.54*s,Math.sin(giro)*s*.23));
    agregarRama(base,pie,.195*s);agregarRama(pie,arranque,.15*s);
    for(let i=0;i<7;i++){
      const ang=i*.898+AZAR()*.4, rad=(.55+AZAR()*.51)*s;
      const bif=arranque.clone().add(new T.Vector3(Math.cos(ang)*rad,.55*s+AZAR()*.3*s,Math.sin(ang)*rad));
      agregarRama(arranque,bif,.077*s);
      for(let j=0;j<4;j++){
        const a=ang+AZAR()*2-.9, r=(.12+AZAR()*.48)*s;
        const copa=bif.clone().add(new T.Vector3(Math.cos(a)*r,(.18+AZAR()*.6)*s,Math.sin(a)*r));
        agregarRama(bif,copa,.035*s);
        for(let k=0;k<11;k++){
          pen.position.copy(copa).add(new T.Vector3((AZAR()-.5)*.68*s,(AZAR()-.3)*.44*s,(AZAR()-.5)*.68*s));
          pen.rotation.set((AZAR()-.5)*1.34,AZAR()*Math.PI*2,(AZAR()-.5)*2.2);
          const v=(.63+AZAR()*.63)*s;pen.scale.set(v,v,1);pen.updateMatrix();hojas.push(pen.matrix.clone());
        }
      }
    }
  };
  for(const [x,z,s] of [[-10.58,3.5,1.52],[13.1,-6.4,1.68],[-16.5,9.1,1.05],[-14,-14,1.70],[-20,-2,1.60],[1,-16,1.43],[11.5,-21,1.68],[-25,17,1.35]]) arbol(x,z,s);
  function instanciar(g,mat,formas){
    const obj=new T.InstancedMesh(g,mat,formas.length);
    formas.forEach((matrix,index)=>obj.setMatrixAt(index,matrix));
    obj.castShadow=true;obj.receiveShadow=true;padre.add(obj);
  }
  instanciar(new T.CylinderGeometry(.73,1,1,7),m.corteza,segmentos);
  instanciar(new T.PlaneGeometry(1,1),m.hojas,hojas);
}

function hierbas(padre,m){
  const geo=new T.BufferGeometry(),verts=[],color=[];
  const ocre=new T.Color('#bbab79'),verde=new T.Color('#77794a'),sombra=new T.Color('#535c39');
  const tonos=[sombra,verde,ocre];
  for(let n=0;n<640;n++){
    const x=(AZAR()-.5)*36,z=(AZAR()-.5)*32;
    if(x>11.05 && z>-.55 && z<3.85)continue;
    if(x>-12.4 && x<11.6 && z>-5.8 && z<19.8)continue;
    if(z>3.5 && z<14 && x>-2.9 && x<.5)continue;
    const escala=.48+AZAR()*1.3;
    for(let i=0;i<17;i++){
      const a=AZAR()*Math.PI*2,ancho=.009+AZAR()*.008;
      const rx=Math.cos(a)*ancho,rz=Math.sin(a)*ancho;
      const tallo=(.08+AZAR()*.25)*escala;
      const bx=x+(AZAR()-.5)*.21*escala,bz=z+(AZAR()-.5)*.21*escala;
      verts.push(bx-rx,-.039,bz-rz,bx+rx,-.039,bz+rz,bx+Math.sin(a)*tallo*.63,tallo-.04,bz+Math.cos(a)*tallo*.63);
      for(let j=0;j<3;j++){const t=tonos[j===2 && AZAR()>.4?2:j===2?1:0]; color.push(t.r,t.g,t.b);}
    }
  }
  geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(color,3));geo.computeVertexNormals();malla(padre,geo,m.herbazal);
  const rocas=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),m.caliza,67);
  const transform=new T.Object3D();
  for(let i=0;i<67;i++){
    const lado=i%2===0?1:-1;
    transform.position.set(lado*(11.8+AZAR()*7),-.02,(AZAR()-.5)*28);
    if(transform.position.x>11 && transform.position.z>-.5 && transform.position.z<3.85)transform.position.z+=5;
    const escala=.035+AZAR()*.12;
    transform.scale.set(escala*1.2,escala*.55,escala*(.7+AZAR()*.7));
    transform.rotation.set(AZAR()*.6,AZAR()*6,AZAR()*.3);
    transform.updateMatrix();rocas.setMatrixAt(i,transform.matrix);
  }
  rocas.receiveShadow=rocas.castShadow=true;padre.add(rocas);
}

function paisaje(padre,m){
  function elevacion(x,z){
    const r=Math.hypot(x,z);
    const ondas=3.7+2.3*Math.sin(x*.052+z*.025)+2.2*Math.sin(z*.070+x*.018)+1.15*Math.cos(x*.11-z*.063);
    const base=-.17+T.MathUtils.smoothstep(r,22,64)*ondas*.62+T.MathUtils.smoothstep(r,67,94)*1.8;
    return T.MathUtils.lerp(base,-5.6,T.MathUtils.smoothstep(z-lineaCosta(x),-4.4,4.4));
  }
  const geo=new T.PlaneGeometry(240,240,160,160);
  geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position,claro=new T.Color('#f2ebcf'),oliva=new T.Color('#cdd6b4'),barro=new T.Color('#f8dfbe'),rgb=[];
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),radio=Math.hypot(x,z);
    pos.setY(i,elevacion(x,z));
    const mezcla=.5+.22*Math.sin(x*.18+z*.076)+.14*Math.cos(z*.185)+.08*Math.sin(x*.61-z*.33);
    const color=claro.clone().lerp(oliva,mezcla).lerp(barro,1-T.MathUtils.smoothstep(radio,17,42));
    color.lerp(barro,T.MathUtils.smoothstep(z-lineaCosta(x),-5.4,-.95));
    rgb.push(color.r,color.g,color.b);
  }
  geo.setAttribute('color',new T.Float32BufferAttribute(rgb,3));geo.computeVertexNormals();
  const terreno=malla(padre,geo,m.lomas);terreno.castShadow=false;terreno.receiveShadow=false;
  const pinos=[[-17,-7,7.3,3.85],[-22,-10,5.4,2.7],[20,-13,7.9,4.0],[-5,-25,6.9,3.7],
    [26,-24,5.7,2.9],[-32,9,6.2,3.4],[-35,4,4.8,2.3],[6,-39,5.5,3.0]];
  plantarPinos(padre,pinos.map(([x,z,h,r])=>[x,elevacion(x,z),z,h,r]),m.corteza,m.aciculas,8527);
  // Bancales de piedra seca a media ladera, siguiendo la pendiente por detrás de la villa.
  const mampuestos=[], coloresPiedra=[], cantero=aleatorio(519), bloque=new T.Object3D();
  for(const [inicio,fin,zBase] of [[-41,5,-18.8],[-29,30,-29.7],[4,38,-35]]) {
    for(let hilada=0;hilada<3;hilada++){
      let x=inicio+hilada*.23;
      while(x<fin){
        const largo=.55+cantero()*.81;
        const z=zBase+1.7*Math.sin(x*.091)+hilada*.095;
        bloque.position.set(x+largo*.5,elevacion(x,z)+.10+hilada*.236,z);
        bloque.rotation.set((cantero()-.5)*.18,-.15*Math.cos(x*.091),(cantero()-.5)*.13);
        bloque.scale.set(largo*.63,.19+cantero()*.055,.34+cantero()*.09);
        bloque.updateMatrix();mampuestos.push(bloque.matrix.clone());
        coloresPiedra.push(new T.Color().setHSL(.092+cantero()*.025,.13+cantero()*.10,.60+cantero()*.24));
        x+=largo*.94;
      }
    }
  }
  const bancales=new T.InstancedMesh(new T.DodecahedronGeometry(1),m.caliza,mampuestos.length);
  mampuestos.forEach((matriz,i)=>{bancales.setMatrixAt(i,matriz);bancales.setColorAt(i,coloresPiedra[i]);});
  bancales.castShadow=true;bancales.receiveShadow=true;bancales.userData.paisajismo=true;padre.add(bancales);
  const obj=new T.Object3D(),matorral=new T.InstancedMesh(new T.PlaneGeometry(1,1),m.monte,1100);
  const rng=aleatorio(468);
  const piedras=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),m.caliza,220);
  for(let i=0;i<piedras.count;i++){
    const x=(rng()-.5)*185,z=lineaCosta(x)-.4+(rng()-.47)*5.5;
    const radio=.15+.78*rng()**2;
    obj.position.set(x,elevacion(x,z)+.13,z);obj.rotation.set(rng()*.5,rng()*6.28,rng()*.56);
    obj.scale.set(radio*1.75,radio*.69,radio);obj.updateMatrix();piedras.setMatrixAt(i,obj.matrix);
  }
  piedras.receiveShadow=true;padre.add(piedras);
  let n=0;
  for(let fila=-13;fila<=13;fila++)for(let col=-13;col<=13;col++){
    const x=col*6.7+1.25*Math.sin(fila*.55+col*.21)+(rng()-.5)*1.6;
    const z=fila*6.15+.65*Math.cos(col*.28)+(rng()-.5)*1.1;
    const r=Math.hypot(x,z),ang=Math.atan2(x,z);
    if(z>20 || r<24 || r>39 || rng()<.23 || n+2>matorral.instanceMatrix.count)continue;
    const s=(.61+rng()*.64)*(1-.75*T.MathUtils.smoothstep(r,30,39));obj.position.set(x,elevacion(x,z)+s*.53,z);
    obj.rotation.set(0,ang,0);obj.scale.set(s*1.8,s*1.25,1);
    obj.updateMatrix();matorral.setMatrixAt(n++,obj.matrix);
    obj.rotation.y+=Math.PI/2;obj.updateMatrix();matorral.setMatrixAt(n++,obj.matrix);
  }
  matorral.count=n;
  padre.add(matorral);
}

export function construirInstalacion(padre,m) {
  AZAR=aleatorio(245);
  paisaje(padre,m);olivar(padre,m);hierbas(padre,m);
  crearVilla(padre,m);
  const cubierta=fotovoltaica(padre,m), equipo=acumulador(padre,m);
  let anterior=-1;
  function progreso(valor){
    const p=T.MathUtils.clamp(valor,0,1);
    if(p===anterior)return;
    cubierta(p);equipo(p);anterior=p;
  }
  progreso(1);return progreso;
}
