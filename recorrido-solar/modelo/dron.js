import {MathUtils,Vector3} from './vendor/three.module.min.js';
import {encuadrarViaje} from './travelling.js?v=53302cb81952';

const foco=new Vector3();
const anguloInicial=Math.atan2(12.32+.55,26.4-3.05);
const radioInicial=Math.hypot(12.32+.55,26.4-3.05);

// La primera pose es la óptica del salón. La órbita sube por el costado este,
// cruza por detrás de la cubierta y acaba mirando a través del jardín hacia el mar.
export function encuadrarDron(camara,progreso,despegue=0) {
  if(progreso<=0){encuadrarViaje(camara,1);return;}
  const t=MathUtils.clamp(progreso,0,1);
  const arco=MathUtils.smootherstep(t,0,1);
  const mar=MathUtils.smootherstep(t,.33,.97);
  const angulo=MathUtils.lerp(anguloInicial,3.56,arco);
  const radio=MathUtils.lerp(radioInicial,28.2,arco);
  const altura=7.62+9.2*MathUtils.smootherstep(t,0,.77)-1.35*MathUtils.smoothstep(t,.77,1);
  camara.position.set(-.55+radio*Math.sin(angulo),altura,3.05+radio*Math.cos(angulo));
  foco.set(-.55+2.8*mar,2.45+1.62*mar,3.05+25*mar);
  if(despegue>0){
    const direccion=foco.clone().sub(camara.position).normalize();
    const rumbo=Math.atan2(direccion.x,direccion.z)-.44*despegue;
    const cabeceo=MathUtils.lerp(Math.asin(direccion.y),.085,despegue);
    camara.position.x+=10.2*despegue;camara.position.z+=82*despegue;camara.position.y+=19*despegue;
    foco.copy(camara.position).add(new Vector3(Math.sin(rumbo)*Math.cos(cabeceo),Math.sin(cabeceo),Math.cos(rumbo)*Math.cos(cabeceo)));
  }
  camara.lookAt(foco);
  const horizontal=MathUtils.smoothstep(camara.aspect,.88,1.5);
  const base=MathUtils.lerp(1.28,1.30,arco);
  const apertura=Math.min(3.1,Math.max(1,base/camara.aspect));
  const lente=MathUtils.lerp(35.4,46.0,MathUtils.smoothstep(t,0,.76));
  camara.fov=MathUtils.radToDeg(2*Math.atan(Math.tan(MathUtils.degToRad(lente)*.5)*apertura));
  camara.updateProjectionMatrix();
  camara.projectionMatrix.elements[8]-=MathUtils.lerp(.168,.024,arco)*horizontal;
  camara.projectionMatrix.elements[9]-=MathUtils.lerp(.30,.20,arco)*(1-horizontal);
  camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
}
