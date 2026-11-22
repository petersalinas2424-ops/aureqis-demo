import * as T from './vendor/three.module.min.js';
import {aleatorio} from './materiales.js?v=53302cb81952';

// Las ramas crecen desde una horquilla baja. Cada terminal lleva varias ramillas
// orientadas en distintos planos para conservar el volumen en el vuelo del dron.
export function plantarPinos(grupo, ejemplares, madera, aciculas, semilla) {
  const azar=aleatorio(semilla), eje=new T.Vector3(0,1,0), pieza=new T.Object3D();
  const ramas=[], brotes=[], tintes=[];
  function rama(a,b,radio) {
    const direccion=b.clone().sub(a);
    pieza.position.copy(a).lerp(b,.5);
    pieza.scale.set(radio,direccion.length()*1.025,radio);
    pieza.quaternion.setFromUnitVectors(eje,direccion.normalize());
    pieza.updateMatrix();ramas.push(pieza.matrix.clone());
  }
  for(const [x,y,z,altura,radio] of ejemplares) {
    const angulo=azar()*Math.PI*2;
    const base=new T.Vector3(x,y-.10,z);
    const codo=base.clone().add(new T.Vector3(Math.cos(angulo)*altura*.055,altura*.28,Math.sin(angulo)*altura*.055));
    const cruz=codo.clone().add(new T.Vector3(altura*(azar()-.48)*.12,altura*.24,altura*(azar()-.48)*.12));
    rama(base,codo,altura*.045);rama(codo,cruz,altura*.032);
    for(let i=0;i<8;i++) {
      const a=angulo+i*2.39996+azar()*.32;
      const r=radio*(.40+.55*azar());
      const arranque=cruz.clone().lerp(codo,azar()*.40);
      const horquilla=new T.Vector3(x+Math.cos(a)*r*.68,y+altura*(.60+.12*azar()),z+Math.sin(a)*r*.68);
      rama(arranque,horquilla,altura*(.014+.006*azar()));
      for(let j=0;j<3;j++) {
        const direccion=a+(j-1)*.62+azar()*.22;
        const largo=radio*(.20+.29*azar());
        const punta=horquilla.clone().add(new T.Vector3(Math.cos(direccion)*largo,altura*(.08+.08*azar()),Math.sin(direccion)*largo));
        rama(horquilla,punta,altura*.009);
        for(let k=0;k<6;k++) {
          const giro=direccion+k*2.39996, dispersion=radio*(.07+.18*azar());
          pieza.position.set(punta.x+Math.cos(giro)*dispersion,punta.y+altura*(.01+.08*azar()),punta.z+Math.sin(giro)*dispersion);
          pieza.rotation.set(-.22-azar()*.83,giro,(azar()-.5)*.6,'YXZ');
          const ancho=radio*(.49+.33*azar());
          pieza.scale.set(ancho,ancho*(.57+.17*azar()),1);
          pieza.updateMatrix();brotes.push(pieza.matrix.clone());
          tintes.push(new T.Color().setHSL(.19+azar()*.035,.09+azar()*.12,.74+azar()*.19));
        }
      }
    }
  }
  function lote(geometria,material,matrices,colores) {
    const arboles=new T.InstancedMesh(geometria,material,matrices.length);
    matrices.forEach((matriz,i)=>{
      arboles.setMatrixAt(i,matriz);
      if(colores)arboles.setColorAt(i,colores[i]);
    });
    arboles.userData.paisajismo=true;
    arboles.castShadow=true;arboles.receiveShadow=true;grupo.add(arboles);
    return geometria;
  }
  // Una ramilla tiene volumen incluso vista de canto. Sus agujas reciben luz
  // de toda la bóveda celeste, independientemente del plano que porta la textura.
  const ramilla=new T.PlaneGeometry(1,1,4,3);
  const vertices=ramilla.attributes.position;
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i), y=vertices.getY(i);
    vertices.setZ(i,.11*(1-4*x*x)+.055*Math.sin(y*5+x*2));
  }
  ramilla.computeVertexNormals();
  aciculas.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',
      '#include <normal_fragment_begin>\nnormal=normalize(mat3(viewMatrix)*vec3(.28*(vMapUv.x-.5),1.,.24*(vMapUv.y-.5)));');
  };
  aciculas.customProgramCacheKey=()=>'aciculas-pino';
  return [lote(new T.CylinderGeometry(.68,1,1,8),madera,ramas),
    lote(ramilla,aciculas,brotes,tintes)];
}
