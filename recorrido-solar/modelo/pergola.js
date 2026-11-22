import * as T from './vendor/three.module.min.js';
import {cargarVehiculo} from './vehiculos.js?v=53302cb81952';

// Seis plazas frente a las oficinas. Los apoyos quedan al fondo y dejan libre
// el frente de las plazas para entrar, salir y abrir las puertas.
export function crearPergola(escena,{geo,mat,base,plano,tubo,curva,solar,registrar,alCargar}){
  const conjunto=new T.Group();conjunto.position.set(25.35,.16,39.71);escena.add(conjunto);
  const acero=mat('#566867',{metalness:.54,roughness:.38});
  const canto=mat('#b7c3be',{metalness:.65,roughness:.32});
  const claro=mat('#e3e5dc',{roughness:.39}),caucho=mat('#263132');
  const marca=mat('#70b594',{roughness:.76});
  const piloto=mat('#a3f9c9',{emissive:'#40dd96',emissiveIntensity:.86});
  const anclaje=mat('#b7b3a6');
  const animaciones=[];
  function fase(inicio,fin,altura,crece=false){
    const grupo=new T.Group();conjunto.add(grupo);animaciones.push({grupo,inicio,fin,altura,crece});return grupo;
  }
  function pieza(grupo,g,m,x,y,z,a,h,f,rx=0){
    const obj=new T.Mesh(g,m);obj.position.set(x,y,z);obj.scale.set(a,h,f);obj.rotation.x=rx;
    obj.castShadow=true;obj.receiveShadow=true;grupo.add(obj);return obj;
  }
  const altura=z=>3.38+.12*z, pendiente=-Math.atan(.12);
  for(let i=0;i<4;i++){
    const x=(i-1.5)*5.34, z=-1.72;
    const pie=fase(.10+i*.03,.19+i*.03,.12);
    pieza(pie,base,anclaje,x,.10,z,.58,.20,.70);
    pieza(pie,base,canto,x,.225,z,.44,.05,.54);
    for(const dx of [-.15,.15])for(const dz of [-.19,.19])pieza(pie,tubo,acero,x+dx,.265,z+dz,.032,.05,.032);
    const apoyo=fase(.17+i*.026,.30+i*.026,0,true);
    pieza(apoyo,base,acero,x,1.64,z,.20,2.80,.27);
    const tirante=pieza(apoyo,base,acero,x,2.75,-.87,.15,2.10,.17);
    tirante.rotation.x=.90;
    const viga=fase(.29+i*.017,.42+i*.017,.72);
    pieza(viga,base,acero,x,altura(0)-.14,0,.17,.25,5.00,pendiente);
    for(const lado of [-1,1])pieza(viga,base,canto,x,altura(0)-.14+lado*.125,0,.25,.033,5.02,pendiente);
  }
  const correas=fase(.37,.49,.6);
  for(const z of [-2.22,-.83,.83,2.22])pieza(correas,base,canto,0,altura(z)+.035,z,16.57,.115,.09);
  pieza(correas,base,acero,0,altura(2.45)+.015,2.46,16.65,.23,.08);
  // Cada pareja de módulos baja hasta las correas y se asienta con la misma pendiente.
  for(let c=0;c<14;c++){
    const grupo=fase(.46+c*.014,.58+c*.014,1.36);
    for(const z of [-1.23,1.23]){
      const x=(c-6.5)*1.19, y=altura(z)+.16;
      pieza(grupo,base,canto,x,y,z,1.168,.076,2.43,pendiente);
      pieza(grupo,plano,solar,x,y+.043,z,1.15,2.42,1,pendiente-Math.PI/2);
    }
  }
  const cargador=fase(.67,.82,.7);
  const cx=8.92,cz=-2.32;
  pieza(cargador,base,anclaje,cx,.075,cz,.57,.15,.64);
  pieza(cargador,curva,acero,cx,.65,cz,.32,1.12,.27);
  pieza(cargador,curva,claro,cx,1.44,cz,.50,.80,.32);
  pieza(cargador,curva,caucho,cx,1.49,cz+.162,.36,.55,.036);
  const pantalla=document.createElement('canvas');pantalla.width=240;pantalla.height=160;
  const ctx=pantalla.getContext('2d');ctx.fillStyle='#102c30';ctx.fillRect(0,0,240,160);
  ctx.strokeStyle='#69edb3';ctx.lineWidth=6;ctx.beginPath();ctx.arc(120,60,36,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#a0ffce';ctx.beginPath();ctx.moveTo(127,32);ctx.lineTo(103,64);ctx.lineTo(118,64);ctx.lineTo(111,87);ctx.lineTo(138,53);ctx.lineTo(122,53);ctx.fill();
  ctx.fillStyle='#e9fff2';ctx.textAlign='center';ctx.font='600 25px sans-serif';ctx.fillText('RECARGA',120,131);
  const grafica=registrar(new T.CanvasTexture(pantalla));grafica.colorSpace=T.SRGBColorSpace;
  pieza(cargador,plano,mat('#ffffff',{map:grafica,emissive:'#e5fff3',emissiveMap:grafica,emissiveIntensity:.22}),cx,1.56,cz+.186,.28,.187,1);
  for(const lado of [-1,1]){
    pieza(cargador,tubo,acero,cx+lado*.38,.325,cz+.12,.047,.65,.047);
    pieza(cargador,tubo,marca,cx+lado*.38,.56,cz+.12,.049,.075,.049);
  }
  const indicador=pieza(cargador,base,piloto,cx,1.33,cz+.191,.22,.024,.014);
  const toma=[6.675+.848,.93,-1.47];
  const eje=new T.Vector3(.82,-.55,.16).normalize();
  const extremo=new T.Vector3(...toma).addScaledVector(eje,.223);
  const puntos=[[cx+.21,1.38,cz+.08],[cx+.29,.92,cz+.28],[cx+.26,.38,cz+.48],
    [cx+.03,.19,cz+.65],[toma[0]+.55,.18,toma[2]+.25],[toma[0]+.31,.55,toma[2]+.12],extremo.toArray()];
  const conexion=fase(.935,.984,0);
  const cable=new T.Mesh(geo(new T.TubeGeometry(new T.CatmullRomCurve3(puntos.map(v=>new T.Vector3(...v))),30,.026,8,false)),caucho);
  cable.castShadow=true;conexion.add(cable);
  const clavija=new T.Group();clavija.position.set(...toma);
  clavija.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),eje);conexion.add(clavija);
  function perfil(material,puntos){
    const forma=geo(new T.LatheGeometry(puntos.map(([r,y])=>new T.Vector2(r,y)),20));
    const parte=new T.Mesh(forma,material);parte.castShadow=true;clavija.add(parte);
  }
  perfil(caucho,[[.013,-.03],[.058,-.014],[.060,.025],[.047,.044]]);
  perfil(claro,[[.047,.028],[.053,.043],[.053,.092],[.042,.134],[.034,.149]]);
  perfil(caucho,[[.034,.14],[.036,.155],[.031,.173],[.033,.179],[.029,.187],[.03,.194],[.026,.222]]);
  const vehiculos=new T.Group();vehiculos.position.copy(conjunto.position);escena.add(vehiculos);
  const coche=new T.Group();vehiculos.add(coche);coche.position.set(6.675,0,14);
  // Las cuatro zonas de contacto siguen la distancia entre ejes de cada modelo.
  const sombraPneu=document.createElement('canvas');sombraPneu.width=96;sombraPneu.height=160;
  const pincel=sombraPneu.getContext('2d');
  function mancha(x,y,rx,ry,opacidad){
    pincel.save();pincel.translate(x,y);pincel.scale(rx,ry);
    const degradado=pincel.createRadialGradient(0,0,0,0,0,1);
    degradado.addColorStop(0,'rgba(12,17,20,'+opacidad+')');degradado.addColorStop(.5,'rgba(12,17,20,'+opacidad*.71+')');
    degradado.addColorStop(1,'rgba(12,17,20,0)');pincel.fillStyle=degradado;pincel.fillRect(-1,-1,2,2);pincel.restore();
  }
  mancha(48,80,45,75,.6);
  for(const x of [18,78])for(const y of [38,122])mancha(x,y,12,13,.77);
  const sombra=new T.MeshBasicMaterial({map:registrar(new T.CanvasTexture(sombraPneu)),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  function apoyar(padre,x,w,l){
    const huella=new T.Mesh(plano,sombra);huella.position.set(x,.013,0);huella.rotation.x=-Math.PI/2;
    huella.scale.set(w,l,1);padre.add(huella);
  }
  apoyar(coche,0,2.45,4.90);apoyar(vehiculos,-12.04,2.49,5.10);
  const ruedas=[];
  let cargado=false;
  const retirarCompacto=cargarVehiculo(coche,'compacto-electrico',undefined,modelo=>{
    modelo.traverse(pieza=>{if(/^Rueda_/.test(pieza.name))ruedas.push(pieza);});
    modelo.traverse(pieza=>{
      const m=pieza.material;
      if(!m)return;
      if(m.name==='Bianca_White'){
        m.color.set('#427384');m.roughness=.25;m.metalness=.56;
      }else if(m.name.endsWith('vitres_exterieur') || m.name.endsWith('glass_clear')){
        m.color.set('#657780');m.roughness=.12;m.metalness=.16;
        m.depthWrite=false;
      }else if(m.name.endsWith('wheel_black')){
        m.color.set('#9ca3a4');m.metalness=.68;m.roughness=.32;
      }
    });
    cargado=true;alCargar?.();
  });
  const retirarBerlina=cargarVehiculo(vehiculos,'berlina-electrica',undefined,modelo=>{
    modelo.position.x=-12.04;modelo.rotation.y=.025;
    modelo.traverse(o=>{if(o.material?.name==='CAR_PAINT')o.material.color.set('#555f68');});
    alCargar?.();
  });
  return {
    situar(t){
      conjunto.visible=t>.09;
      const entrada=T.MathUtils.smootherstep(t,.79,.935);
      coche.position.z=(1-entrada)*14;
      coche.position.y=-.086*T.MathUtils.smoothstep(coche.position.z,2.7,5.8);
      for(const rueda of ruedas)rueda.rotation.x=-entrada*14/.34;
      if(!conjunto.visible)return;
      for(const {grupo,inicio,fin,altura,crece} of animaciones){
        const k=T.MathUtils.smootherstep(t,inicio,fin);
        grupo.visible=k>0;grupo.position.y=(1-k)*altura;
        if(crece)grupo.scale.y=Math.max(.001,k);
      }
      conexion.visible=cargado && t>.935;
      // El cable aparece desde el poste hasta el conector del vehículo.
      const recorrido=T.MathUtils.smoothstep(t,.935,.984);
      cable.geometry.setDrawRange(0,Math.floor(30*recorrido)*8*6);
      clavija.visible=recorrido>.95;
      indicador.visible=cargado&&t>.976;
    },
    destruir(){retirarCompacto();retirarBerlina();sombra.dispose();}
  };
}
