import {crearMar,coordenadasBahia} from './orilla.js?v=fafacc8c4dac';
import * as T from './vendor/three.module.min.js';

// Luz directa, relleno, exposición y cielo avanzan en tiempo solar junto al montaje.
// Las intensidades nocturnas dejan sitio a la luz cálida emitida por los interiores.
const horas = [
  [0,    -73, 19, '#ffdfb0',2.75, '#aecdf1','#ddc398',1.02,.84,1.02, '#598fc3','#e9dfca','#cbb89c'],
  [.28,  -37, 56, '#fff2d8',3.06, '#c7e4ff','#d6c3a5',.99,.90,1.02, '#487fbb','#dce8e9','#b3c7c4'],
  [.48,    4, 58, '#fff0d4',2.92, '#c2def4','#cfba99',.95,.86,1.02, '#4b88b8','#d5e6eb','#b9c6bb'],
  [.64,   49, 30, '#ffd4a0',2.48, '#b8cce4','#d4ab88',.90,.75,1.04, '#5d89bc','#f4d6af','#d0b499'],
  [.765,  79,  7, '#ffad72',1.84, '#a3b7dc','#c58a71',.76,.56,1.08, '#6d8ab6','#feb487','#cfa29b'],
  [.83,   92, -2, '#ff9c6f', .23, '#acbcdf','#a18b86',.70,.41,1.09, '#556597','#e3a49c','#a38da4'],
  [.90,  105,-11, '#759ad8', .10, '#91aad4','#837d84',.56,.27,1.11, '#263963','#737396','#656782'],
  [1,    119,-22, '#739adb', .08, '#93a9cb','#696f79',.49,.17,1.12, '#0d1b37','#374463','#3b475d']
].map(([p,az,alt,sol,intSol,zenit,rebote,intRelleno,entorno,exposicion,azul,rasante,bruma]) =>
  ({p,az,alt,sol:new T.Color(sol),intSol,zenit:new T.Color(zenit),rebote:new T.Color(rebote),
    intRelleno,entorno,exposicion,azul:new T.Color(azul),rasante:new T.Color(rasante),bruma:new T.Color(bruma)}));

const frag = `
uniform sampler2D valle, limiteValle, bahia;
uniform vec3 azul, horizonte, bruma, sol, luzSolar;
uniform float noche, ocaso, vueloCosta;
${coordenadasBahia}
varying vec3 direccion;

float azar(vec2 p) {
  vec3 a=fract(vec3(p.xyx)*.1031);
  a+=dot(a,a.yzx+33.33);
  return fract((a.x+a.y)*a.z);
}
float ruido(vec2 p) {
  vec2 i=floor(p), a=fract(p);a=a*a*(3.-2.*a);
  return mix(mix(azar(i),azar(i+vec2(1,0)),a.x),
             mix(azar(i+vec2(0,1)),azar(i+vec2(1)),a.x),a.y);
}
float filamentos(vec2 p) {
  p=mat2(.95,.31,-.31,.95)*p;
  return ruido(p)*.48+ruido(p*2.17)*.30+ruido(p*4.8)*.15+ruido(p*10.15)*.07;
}
void main() {
  const float pi=3.14159265;
  vec3 d=normalize(direccion);
  float el=d.y, u=fract(atan(d.z,d.x)/(2.*pi)+.74);
  float v=.551+2.*asin(clamp(el,-1.,1.))/pi;
  vec2 perfil=texture2D(limiteValle,vec2(u,.5)).rg;
  float limite=1.-dot(perfil,vec2(65280.,255.))/65535.;
  float tierra=1.-smoothstep(limite-.002,limite+.002,v);
  float aire=pow(smoothstep(-.075,1.,el),.38);
  vec3 cielo=mix(horizonte,azul,clamp(aire*1.27,0.,1.));
  float conSol=max(0.,dot(d,sol));
  float sobreHorizonte=smoothstep(-.055,.018,sol.y);
  float brillo=(.06*pow(conSol,7.)+.26*pow(conSol,50.)+.64*pow(conSol,700.))*sobreHorizonte;
  cielo+=luzSolar*brillo;
  cielo+=vec3(1.,.76,.49)*smoothstep(.999951,.999985,conSol)*sobreHorizonte;
  vec2 plano=d.xz/(max(el,.025)+.19);
  float nube=smoothstep(.48,.71,filamentos(plano*vec2(2.2,7.)+vec2(21.8,7.2)));
  cielo=mix(cielo,mix(vec3(.93,.94,.96),vec3(.84,.44,.36),ocaso),
            nube*smoothstep(.015,.17,el)*(.105+.16*ocaso)*(1.-noche));
  vec2 estrellas=vec2(u,asin(clamp(el,-1.,1.))/pi)*650.;
  vec2 celda=floor(estrellas);
  float estrella=1.-smoothstep(.009,.15,length(fract(estrellas)-vec2(azar(celda),azar(celda+12.31))));
  cielo+=vec3(.64,.72,.87)*estrella*step(.994,azar(celda+61.7))*noche*smoothstep(.06,.24,el);
  vec3 dirLuna=normalize(vec3(-.601,.064,-.797));
  vec3 esteLuna=normalize(cross(dirLuna,vec3(0,1,0)));
  vec3 altoLuna=cross(esteLuna,dirLuna);
  vec2 uvLuna=vec2(dot(d,esteLuna),dot(d,altoLuna))/.0069;
  float radioLuna=length(uvLuna);
  float disco=(1.-smoothstep(.90,1.04,radioLuna))*step(.99,dot(d,dirLuna));
  float faseLuna=smoothstep(-.57,-.38,uvLuna.x+.38*sqrt(max(0.,1.-uvLuna.y*uvLuna.y)));
  cielo+=vec3(.82,.83,.75)*disco*(.21+.69*faseLuna)*noche;
  vec3 campo=texture2D(valle,vec2(u,clamp(v,0.,1.))).rgb;
  float gris=dot(campo,vec3(.2126,.7152,.0722));
  vec3 tarde=mix(campo,campo*vec3(.98,.69,.48),.65*ocaso);
  vec3 nocturno=vec3(.010,.017,.031)+gris*vec3(.07,.102,.155);
  campo=mix(tarde,nocturno,noche);
  float aireFotografico=(1.-smoothstep(limite+.003,limite+.065,v))*(1.-noche)*(1.-ocaso*.83);
  cielo=mix(cielo,tarde,aireFotografico);
  campo=mix(campo,bruma,(.11+.17*ocaso)*smoothstep(limite-.13,limite,v));
  vec3 paisaje=mix(cielo,campo,tierra);
  vec2 marino=direccionBahia(d);
  vec3 costero=texture2D(bahia,vec2(marino.x,clamp(marino.y,.008,.995))).rgb;
  costero=mix(costero,vec3(.010,.025,.058),smoothstep(.83,1.25,marino.y));
  gl_FragColor=vec4(mix(paisaje,costero,vueloCosta),1.);
  #include <colorspace_fragment>
}`;

export function crearAmbiente(escena,render,textura) {
  const mapa=textura(innerWidth<720||render.capabilities.maxTextureSize<8192?'valle-movil':'valle');
  mapa.colorSpace=T.SRGBColorSpace;mapa.wrapS=T.RepeatWrapping;
  const borde=textura('horizonte');
  borde.magFilter=borde.minFilter=T.LinearFilter;borde.wrapS=T.RepeatWrapping;borde.needsUpdate=true;
  const bahia=textura('horizonte-marino');bahia.colorSpace=T.SRGBColorSpace;bahia.wrapS=T.RepeatWrapping;
  const aplicarMar=crearMar(escena,bahia,textura);
  const uniformes={vueloCosta:{value:0},bahia:{value:bahia},valle:{value:mapa},limiteValle:{value:borde},azul:{value:new T.Color()},horizonte:{value:new T.Color()},
    bruma:{value:new T.Color()},sol:{value:new T.Vector3()},luzSolar:{value:new T.Color()},noche:{value:0},ocaso:{value:0}};
  const superficie=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,toneMapped:false,uniforms:uniformes,
    vertexShader:'varying vec3 direccion; void main(){direccion=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:frag});
  const cielo=new T.Mesh(new T.SphereGeometry(143,56,28),superficie);
  cielo.renderOrder=-8;escena.add(cielo);
  const sol=new T.DirectionalLight(), relleno=new T.HemisphereLight(), luna=new T.DirectionalLight('#91b0ea',.1);
  sol.castShadow=true;
  sol.target.position.set(0,1.6,1.6);
  const lado=innerWidth<700?1024:2048;
  sol.shadow.mapSize.set(lado,lado);
  Object.assign(sol.shadow.camera,{left:-17.5,right:17.5,top:17.5,bottom:-17.5,near:1,far:100});
  sol.shadow.normalBias=.014;sol.shadow.bias=-.00013;sol.shadow.radius=2;
  // Contraluz azul desde el horizonte de la luna, con detalle en el jardín.
  luna.position.set(-19,12,-25);
  escena.add(sol,sol.target,relleno,luna);
  escena.fog=new T.FogExp2(0xc7c7ae,.008);
  const direccion=new T.Vector3();
  let anterior=-1, intensidadNoche=0;
  return {
    cielo,
    costa(valor,segundos){uniformes.vueloCosta.value=valor;aplicarMar(valor,segundos);},
    destruir(){borde.dispose();},
    aplicar(p) {
      if (p===anterior) return intensidadNoche;
      anterior=p;
      let i=0;while(i<horas.length-2 && p>horas[i+1].p)i++;
      const a=horas[i],b=horas[i+1],fase=T.MathUtils.clamp((p-a.p)/(b.p-a.p),0,1);
      const lerp=(u,v)=>T.MathUtils.lerp(u,v,fase);
      const az=T.MathUtils.degToRad(lerp(a.az,b.az)),alt=T.MathUtils.degToRad(lerp(a.alt,b.alt));
      direccion.set(Math.sin(az)*Math.cos(alt),Math.sin(alt),Math.cos(az)*Math.cos(alt));
      uniformes.sol.value.copy(direccion);
      sol.position.copy(direccion).multiplyScalar(48).add(sol.target.position);
      sol.color.lerpColors(a.sol,b.sol,fase);sol.intensity=lerp(a.intSol,b.intSol);
      uniformes.luzSolar.value.copy(sol.color);
      relleno.color.lerpColors(a.zenit,b.zenit,fase);
      relleno.groundColor.lerpColors(a.rebote,b.rebote,fase);
      relleno.intensity=lerp(a.intRelleno,b.intRelleno);
      intensidadNoche=T.MathUtils.smoothstep(p,.73,.975);
      uniformes.noche.value=T.MathUtils.smoothstep(p,.765,.97);
      uniformes.ocaso.value=T.MathUtils.smoothstep(p,.53,.78)*(1.-T.MathUtils.smoothstep(p,.83,.98));
      uniformes.azul.value.lerpColors(a.azul,b.azul,fase);
      uniformes.horizonte.value.lerpColors(a.rasante,b.rasante,fase);
      uniformes.bruma.value.lerpColors(a.bruma,b.bruma,fase);
      escena.fog.color.copy(uniformes.bruma.value);
      escena.environmentIntensity=lerp(a.entorno,b.entorno);
      escena.environmentRotation.y=T.MathUtils.lerp(-.39,1.18,p);
      render.toneMappingExposure=lerp(a.exposicion,b.exposicion);
      luna.intensity=.035+.42*intensidadNoche;
      return intensidadNoche;
    }
  };
}
