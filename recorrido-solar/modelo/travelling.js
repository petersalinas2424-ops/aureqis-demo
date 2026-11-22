import { MathUtils, Vector3 } from './vendor/three.module.min.js';
import {tiempoVilla} from './guion.js?v=53302cb81952';

// Un solo movimiento de cámara rodea la piscina, sube a la cubierta y sigue la
// instalación por el costado este. El último alejamiento vuelve al jardín.
const claves = [
  [0,    [14.4,7.8,26.7],   [-.65,2.72,2.90], 36],
  [.07,  [12.15,9.05,24.0], [-.70,3.24,2.33], 36],
  [.15,  [8.65,12.6,17.0],  [-.68,5.45,.65], 36.6],
  [.25,  [4.65,14.6,11.6],  [-.52,6.80,-.63], 37.3],
  [.38,  [3.85,14.25,9.8],  [-.27,6.99,-.67], 37.7],
  [.50,  [6.02,13.18,9.82], [.41,6.97,-.62], 37.4],
  [.555, [9.50,11.52,9.65], [2.75,6.29,-.2], 37.0],
  [.615, [13.20,7.20,6.95], [6.20,4.45,.26], 38.3],
  [.67,  [13.38,4.01,3.88], [7.94,2.28,.69], 38.4],
  [.71,  [13.52,2.45,3.29], [8.02,1.95,1.07], 36.7],
  [.77,  [13.45,1.84,3.85], [8.08,1.51,1.44], 36.7],
  [.855, [13.68,2.21,4.74], [8.03,1.53,1.41], 36.7],
  [.91,  [14.60,4.00,7.10], [6.50,1.92,1.46], 36.4],
  [.95,  [15.35,6.00,15.4], [2.86,2.12,2.03], 36.1],
  [.985, [13.58,7.50,24.8], [-.30,2.42,2.95], 35.6],
  [1,    [12.32,7.62,26.4], [-.55,2.45,3.05], 35.4]
].map(([p,ojo,foco,angulo]) => ({p, valores:[...ojo,...foco,angulo]}));

// Hermite monótona en tiempo de desplazamiento. Igual recorrido al bajar y al subir.
function derivada(i, componente) {
  const a = claves[Math.max(0, i-1)], b = claves[i], c = claves[Math.min(claves.length-1, i+1)];
  const pendiente = (x,y) => (y.valores[componente]-x.valores[componente])/(y.p-x.p);
  if (i === 0) return pendiente(b,c);
  if (i === claves.length-1) return pendiente(a,b);
  const entrada = pendiente(a,b), salida = pendiente(b,c);
  if (entrada * salida <= 0) return 0;
  return 2 * entrada * salida / (entrada + salida);
}

claves.forEach((clave,i) => { clave.tangentes = clave.valores.map((_,j) => derivada(i,j)); });

const punto = new Vector3();
const camaraBase = new Vector3();
const valores = new Float64Array(7);

export function encuadrarViaje(camara, progreso) {
  const ultimo = claves.length-1;
  let i=0;
  while (i < ultimo-1 && progreso > claves[i+1].p) i++;
  const a=claves[i], b=claves[i+1], intervalo=b.p-a.p;
  const t=MathUtils.clamp((progreso-a.p)/intervalo,0,1), tt=t*t, ttt=tt*t;
  for (let j=0;j<valores.length;j++) {
    valores[j]=(2*ttt-3*tt+1)*a.valores[j] + (ttt-2*tt+t)*a.tangentes[j]*intervalo
      + (-2*ttt+3*tt)*b.valores[j] + (ttt-tt)*b.tangentes[j]*intervalo;
  }
  punto.fromArray(valores,3);
  camaraBase.fromArray(valores);
  // Mantiene el edificio completo en vertical sin alejar la vista de detalle del inversor.
  const aspecto=camara.aspect;
  const cerca=MathUtils.smoothstep(progreso,.57,.67)*(1-MathUtils.smoothstep(progreso,.91,1));
  const cubierta=MathUtils.smoothstep(progreso,.08,.22)*(1-MathUtils.smoothstep(progreso,.50,.61));
  const aspectoBase=MathUtils.lerp(1.28+.14*cubierta,.89,cerca);
  const apertura=Math.min(3.1,Math.max(1,aspectoBase/aspecto));
  camara.position.copy(camaraBase);
  camara.lookAt(punto);
  const mitad=MathUtils.degToRad(valores[6])*.5;
  camara.fov=MathUtils.radToDeg(2*Math.atan(Math.tan(mitad)*apertura));
  camara.updateProjectionMatrix();
  // Descentramiento óptico: reserva el margen editorial sin inclinar el horizonte.
  const horizontal=MathUtils.smoothstep(aspecto,.88,1.5);
  camara.projectionMatrix.elements[8] -= MathUtils.lerp(.168,.25,cerca)*horizontal;
  camara.projectionMatrix.elements[9] -= .30*(1-horizontal);
  camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
}

const ojoPatio = new Vector3();
const focoPatio = new Vector3();
export function encuadrarResidencial(camara, recorrido) {
  encuadrarViaje(camara, tiempoVilla(recorrido));
  const mezcla = MathUtils.smoothstep(recorrido,.572,.647) * (1-MathUtils.smoothstep(recorrido,.698,.786));
  if (mezcla <= 0) return;
  const tramo = MathUtils.smoothstep(recorrido,.60,.72);
  ojoPatio.set(20.25-.54*tramo,3.40-.24*tramo,9.32-.38*tramo);
  focoPatio.set(14.86+.12*tramo,1.05,2.0);
  camara.position.lerp(ojoPatio,mezcla);
  camara.lookAt(punto.lerp(focoPatio,mezcla));
  const vertical=1-MathUtils.smoothstep(camara.aspect,.66,1.04);
  const apertura=Math.max(1,Math.min(3.6,(1.04+.17*vertical)/camara.aspect));
  const optica=MathUtils.radToDeg(2*Math.atan(Math.tan(MathUtils.degToRad(34)/2)*apertura));
  const dx=camara.projectionMatrix.elements[8],dy=camara.projectionMatrix.elements[9];
  camara.fov=MathUtils.lerp(camara.fov,optica,mezcla);
  camara.updateProjectionMatrix();
  camara.projectionMatrix.elements[8]=dx+.055*vertical*mezcla;
  camara.projectionMatrix.elements[9]=dy;
  camara.projectionMatrixInverse.copy(camara.projectionMatrix).invert();
}
