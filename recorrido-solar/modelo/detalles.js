import * as T from './vendor/three.module.min.js';

// El mobiliario se agrupa por acabado, igual que los elementos de la villa.
export function vestirVilla(pieza, cubo, cilindro, bola, materiales) {
  const {teca, gres, salvia, lino, hoja, cobre, miel, papel, carbon, luz, manta} = materiales;
  const torno = (perfil, pasos=24) => new T.LatheGeometry(perfil.map(([r,y])=>new T.Vector2(r,y)),pasos);
  const jarra=torno([[.02,0],[.13,.015],[.19,.13],[.17,.24],[.085,.31],[.075,.40],[.091,.41],[.085,.43],[.065,.42],[.06,.365]]);
  const tiesto=torno([[.17,0],[.22,.035],[.29,.40],[.31,.41],[.31,.46],[.26,.46],[.25,.40]]);
  const plato=torno([[0,.012],[.08,.014],[.125,.032],[.137,.034],[.137,.022],[.085,0],[0,0]]);
  const liston=new T.CylinderGeometry(1,1,1,8);
  function rama(mat,desde,hasta,r){
    const a=new T.Vector3(...desde),b=new T.Vector3(...hasta),eje=b.clone().sub(a);
    const rot=new T.Euler().setFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),eje.clone().normalize()));
    a.lerp(b,.5);pieza(liston,mat,a.x,a.y,a.z,r,eje.length(),r,rot.x,rot.y,rot.z);
  }
  const aro=new T.TorusGeometry(1,.1,7,26);
  function maceta(x,y,z,s){
    pieza(tiesto,gres,x,y,z,s,s,s);
    cilindro(carbon,x,y+.405*s,z,.259*s,.021*s);
    for(let i=0;i<11;i++){
      const a=i*2.4, largo=(.8+.23*Math.sin(i*1.8))*s, inclinacion=.38+.06*(i%5);
      const hojaGeo=new T.PlaneGeometry(1,1,4,8),v=hojaGeo.attributes.position;
      for(let j=0;j<v.count;j++){
        const u=hojaGeo.attributes.uv.getX(j)*2-1,t=hojaGeo.attributes.uv.getY(j);
        const ancho=Math.pow(Math.sin(Math.PI*t),.85)*.098*largo+.006;
        const fuera=largo*(.13*t+inclinacion*t*t)+.045*largo*Math.abs(u)*Math.sin(Math.PI*t);
        v.setXYZ(j,Math.sin(a)*fuera+Math.cos(a)*u*ancho,largo*(1.17*t-.32*t*t),Math.cos(a)*fuera-Math.sin(a)*u*ancho);
      }
      hojaGeo.computeVertexNormals();pieza(hojaGeo,hoja,x,y+.408*s,z);hojaGeo.dispose();
    }
  }
  // El comedor se lee desde el cristal delantero. La planta llega a la altura del cortinaje.
  maceta(3.64,.38,1.75,1.38);
  maceta(-4.79,3.74,.60,.86);
  cubo(lino,.56,.880,-.15,2.46,.010,.31);
  pieza(jarra,salvia,.50,.888,-.15,1.08,1.10,1.08);
  for(let i=0;i<5;i++){
    const a=i*2.18,dx=Math.cos(a)*.26,dz=Math.sin(a)*.19,h=.4+.06*(i%3);
    rama(teca,[.50,1.29,-.15],[.50+dx,1.29+h,-.15+dz],.007);
    for(let j=1;j<=5;j++){
      const t=j/5,lado=j%2?1:-1;
      pieza(bola,hoja,.50+dx*t+.026*lado,1.28+h*t,-.15+dz*t,.018,.057,.013,.44,a,-.48*lado);
    }
  }
  for(const x of [-.27,1.33])for(const z of [-.44,.15])pieza(plato,lino,x,.88,z);
  cubo(salvia,-4.55,.798,1.02,.34,.031,.245,.16);
  cubo(papel,-4.55,.823,1.02,.32,.02,.23,.16);
  // Manta extendida desde el asiento hasta el frente del sofá; el fleco sigue cada pliegue.
  const tejido=new T.PlaneGeometry(1,1,30,24),puntos=tejido.attributes.position;
  function caer(u,v){
    const onda=Math.sin(u*Math.PI*9+.45*Math.sin(v*5));
    const borde=T.MathUtils.smoothstep(v,.52,.64);
    return [-4.13+(u-.5)*.86+.04*Math.sin(v*3),
      .951-.37*Math.max(0,(v-.57)/.43)+.017*onda,
      -.88+.66*Math.min(v/.59,1)+borde*(.024*onda-.025*v)];
  }
  for(let i=0;i<puntos.count;i++)puntos.setXYZ(i,...caer(tejido.attributes.uv.getX(i),tejido.attributes.uv.getY(i)));
  tejido.computeVertexNormals();pieza(tejido,manta,0,0,0);tejido.dispose();
  for(let i=0;i<=23;i++){
    const a=caer(i/23,1);rama(lino,a,[a[0]+.006*Math.sin(i),a[1]-.045,a[2]+.003],.005);
  }
  pieza(jarra,gres,-2.55,2.39,-3.12,1.08,1.18,1.08);
  pieza(jarra,lino,-2.15,2.39,-3.10,.74,.7,.74);

  // Sombra de lectura en el extremo del patio. Los ocho paños tienen caída y costuras radiales.
  const x=-8.62,z=7.61;
  cilindro(gres,x,.29,z,.345,.12);cilindro(teca,x,1.56,z,.033,2.50);
  const radio=1.58;
  for(let i=0;i<8;i++){
    const p=[],ind=[];
    for(let fila=0;fila<=5;fila++)for(let col=0;col<=6;col++){
      const t=fila/5,u=col/6,a=(i+u)*Math.PI/4;
      const r=radio*t*(1-.068*Math.sin(Math.PI*u));
      p.push(Math.cos(a)*r,-.46*t*t-.083*t*t*Math.sin(Math.PI*u),Math.sin(a)*r);
      if(fila<5 && col<6){const j=fila*7+col;ind.push(j,j+1,j+7,j+1,j+8,j+7);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ind);g.computeVertexNormals();
    pieza(g,i%2?lino:salvia,x,2.85,z);g.dispose();
  }
  pieza(bola,cobre,x,2.87,z,.065,.055,.065);
  const mesaZ=7.95,mesaX=-7.98;
  cilindro(teca,mesaX,.48,mesaZ,.067,.47);cilindro(teca,mesaX,.733,mesaZ,.37,.045);
  pieza(plato,lino,mesaX-.11,.757,mesaZ);
  cilindro(gres,mesaX-.11,.806,mesaZ,.065,.086);
  pieza(aro,gres,mesaX-.042,.81,mesaZ,.028,.03,.028);
  cubo(salvia,mesaX+.17,.774,mesaZ+.05,.18,.032,.24,-.22);
  // Butaca baja de teca y cincha trenzada, orientada a la piscina.
  const ax=-8.92,az=8.42;
  for(const dz of [-.32,.32]){
    rama(teca,[ax-.36,.23,az+dz],[ax-.25,1.09,az+dz],.032);
    rama(teca,[ax+.34,.23,az+dz],[ax+.29,.80,az+dz],.032);
    rama(teca,[ax-.27,.79,az+dz],[ax+.30,.79,az+dz],.034);
  }
  for(let i=0;i<13;i++){
    const zz=az-.285+i*.0475;
    rama(teca,[ax-.24,.55,zz],[ax+.32,.58,zz],.022);
    rama(teca,[ax-.24,.55,zz],[ax-.38,1.08,zz],.021);
  }
  pieza(bola,lino,ax+.045,.595,az,.29,.063,.318);
  pieza(bola,salvia,ax-.245,.78,az,.073,.18,.28,0,0,.21);
  // Toalla de rizo doblada sobre la tumbona y faroles de acero con vela en la terraza.
  cubo(lino,7.86,.64,6.38,.47,.045,.715);
  for(const dx of [-.16,-.12,.12,.16])cubo(salvia,7.86+dx,.664,6.38,.018,.006,.714);
  for(const [lx,lz,s] of [[-6.8,4.72,1.0],[-6.30,4.83,.70],[8.90,5.30,.84]]){
    const y=.26;
    cubo(carbon,lx,y+.035*s,lz,.32*s,.07*s,.32*s);
    cubo(carbon,lx,y+.53*s,lz,.32*s,.038*s,.32*s);
    for(const dx of [-.14,.14])for(const dz of [-.14,.14])cubo(cobre,lx+dx*s,y+.28*s,lz+dz*s,.021*s,.5*s,.021*s);
    cilindro(miel,lx,y+.18*s,lz,.084*s,.25*s);
    pieza(bola,luz,lx,y+.328*s,lz,.023*s,.05*s,.023*s);
    pieza(aro,cobre,lx,y+.60*s,lz,.076*s,.08*s,.068*s);
  }
  maceta(-7.85,.26,4.08,1.25);maceta(-8.47,.26,4.41,.79);
  for(const geo of [jarra,tiesto,plato,aro,liston])geo.dispose();
}
