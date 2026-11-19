import * as T from './vendor/three.module.min.js';

// Tres golondrinas describen vueltas diferentes detrás de la casa. El ala se
// dobla en la muñeca al recogerla y queda casi horizontal durante el planeo.
export function crearGolondrinas(padre) {
  const bandada=new T.Group();
  padre.add(bandada);
  const pluma=new T.MeshStandardMaterial({color:'#343d40',roughness:.92,side:T.DoubleSide});
  const pecho=new T.MeshStandardMaterial({color:'#c4b3a1',roughness:.95});
  const cuerpo=new T.SphereGeometry(1,10,6);
  const alas=new T.BufferGeometry();
  alas.setAttribute('position',new T.Float32BufferAttribute([
    .025,0,.060, .020,.003,-.084, .21,.042,-.009, .19,.028,-.102, .41,.027,-.118
  ],3));
  alas.setIndex([0,1,2,2,1,3,2,3,4]);alas.computeVertexNormals();
  alas.translate(-.022,0,0);
  const recogida=alas.attributes.position.clone();
  recogida.setXYZ(4,.30,-.045,-.187);
  alas.morphAttributes.position=[recogida];
  const cola=new T.BufferGeometry();
  cola.setAttribute('position',new T.Float32BufferAttribute([-.032,0,-.07,-.096,.014,-.245,0,0,-.141,.096,.014,-.245,.032,0,-.07],3));
  cola.setIndex([0,1,2,0,2,4,4,2,3]);cola.computeVertexNormals();
  const aves=[0,.31,.62].map((fase,i)=>{
    const ave=new T.Group();bandada.add(ave);
    const torso=new T.Mesh(cuerpo,pluma);torso.scale.set(.048,.043,.134);ave.add(torso);
    const vientre=new T.Mesh(cuerpo,pecho);vientre.scale.set(.037,.026,.083);vientre.position.set(0,-.031,.024);ave.add(vientre);
    const cabeza=new T.Mesh(cuerpo,pluma);cabeza.scale.set(.038,.035,.046);cabeza.position.set(0,.015,.110);ave.add(cabeza);
    ave.add(new T.Mesh(cola,pluma));
    const par=[-1,1].map(lado=>{
      const ala=new T.Mesh(alas,pluma);ala.scale.x=lado;ala.position.x=.022*lado;ave.add(ala);
      return ala;
    });
    const escala=[.84,.70,.78][i];ave.scale.setScalar(escala);
    return {ave,par,fase};
  });
  return (reloj,visible)=>{
    bandada.visible=visible;
    if(!visible)return;
    aves.forEach(({ave,par,fase},i)=>{
      const a=reloj*(.28+i*.013)+fase+.98;
      ave.position.set(-1+(11+i*.7)*Math.cos(a),8.6+i*.45+.67*Math.sin(2*a+.61*i),-10.3+4.6*Math.sin(a));
      ave.rotation.order='YXZ';
      ave.rotation.y=Math.atan2(-(11+i*.7)*Math.sin(a),4.6*Math.cos(a));
      ave.rotation.x=-.16*Math.cos(2*a+.61*i);
      ave.rotation.z=.23+.16*Math.cos(a*2);
      const impulso=T.MathUtils.smoothstep(Math.sin(reloj*1.12+fase*5),-.53,.38);
      const batir=Math.sin(reloj*(22+i)+fase*11);
      par.forEach((ala,j)=>{
        const lado=j*2-1;
        ala.rotation.z=lado*(.10+impulso*.66*batir);
        ala.rotation.y=lado*(.025+impulso*.22*(1-batir));
        ala.morphTargetInfluences[0]=impulso*(1-batir)*.5;
      });
    });
  };
}
