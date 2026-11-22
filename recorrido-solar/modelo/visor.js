import {crearEnlace} from './enlace.js?v=fafacc8c4dac';
import {crearGolondrinas} from './aves.js?v=fafacc8c4dac';
import {tiempoParking,FIN_RECORRIDO} from './guion.js?v=fafacc8c4dac';
import * as T from './vendor/three.module.min.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {HDRLoader} from './vendor/HDRLoader.js';
import {crearMateriales} from './materiales.js?v=fafacc8c4dac';
import {construirInstalacion} from './instalacion.js?v=fafacc8c4dac';
import {encuadrarDron} from './dron.js?v=fafacc8c4dac';
import {encuadrarResidencial} from './travelling.js?v=fafacc8c4dac';
import {tiempoVilla,tiempoNave,tiempoDron,progresoResidencial,INICIO_EMPRESAS,DESPEGUE,FIN_ENLACE,CORTE_MUELLES,SEGUNDOS_MANIOBRA} from './guion.js?v=fafacc8c4dac';
import {crearRecarga} from './recarga.js?v=fafacc8c4dac';
import {crearAmbiente} from './ambiente.js?v=fafacc8c4dac';
import {registrarAcabados} from './acabado.js?v=fafacc8c4dac';

const VISTAS={
  salon:{ojo:[2.8,1.66,2.29],foco:[-3.7,1.18,-.90]},
  terraza:{ojo:[5.4,3.47,14.2],foco:[-4.6,1.33,5.64]},
  cubierta:{ojo:[16.5,10.4,25.8],foco:[-.6,2.6,2.9]},
  panel:{ojo:[4.1,12.9,7.4],foco:[.3,6.93,-.6]},
  bateria:{ojo:[12.25,2.06,2.42],foco:[8.06,1.47,1.00]},
  recarga:{ojo:[20.0,3.2,9.1],foco:[14.88,1.08,2.0]}
};

/** Monta el modelo en su contenedor. El póster del sitio queda detrás del lienzo. */
export function montarVisor(contenedor,{guiado=false,onCambio,onListo,onError}={}) {
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;';
  canvas.setAttribute('aria-label',guiado ? 'Casa en tres dimensiones. El montaje avanza al desplazarte por la página.' : 'Modelo tridimensional de una casa con instalación solar. Arrastra para girar y usa dos dedos para acercarte.');
  if (guiado) {canvas.style.touchAction='pan-y';canvas.style.pointerEvents='none';}
  canvas.setAttribute('role','img');
  let render;
  try {
    render=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'default'});
  } catch (e) {
    onError?.(e);
    return {vista(){},progreso(){},luz(){},destruir(){}};
  }
  let cerrado=false,enPantalla=true,frame=0,viaje=null,ultimaVista='cubierta';
  let avance=guiado?0:1, destino=avance, ultimoTiempo=0;
  let recursosListos=false, avisado=false, horaLibre=1, anteriorAvance=-1;
  let nave, preparandoNave;
  let segundosMar=0, segundosMuelle=0, esperaAmbiente=0;
  const reducido=window.matchMedia('(prefers-reduced-motion: reduce)');
  const escena=new T.Scene();
  const camara=new T.PerspectiveCamera(38,1,.065,3000);
  const texturas=new Set();
  render.setPixelRatio(Math.min(window.devicePixelRatio || 1,innerWidth<=700 ? 1.4 : 1.6));
  render.shadowMap.enabled=true;
  render.shadowMap.type=T.PCFSoftShadowMap;
  render.toneMapping=T.ACESFilmicToneMapping;render.toneMappingExposure=1.10;
  escena.background=new T.Color('#c6d0ca');escena.fog=new T.FogExp2('#c7c7ae',.012);
  const carga=new T.LoadingManager();
  carga.onLoad=()=>{recursosListos=true;despertar();};
  const cargador=new T.TextureLoader(carga);
  function textura(nombre,personalizar){
    const tex=cargador.load(new URL('./texturas/'+nombre+'.webp',import.meta.url).href,leida=>{
      if(cerrado){leida.dispose();return;}
      personalizar?.(leida);
      despertar();
    });
    texturas.add(tex);return tex;
  }
  const materiales=crearMateriales(textura,Math.min(8,render.capabilities.getMaxAnisotropy()));
  const ambiente=crearAmbiente(escena,render,textura);
  const entorno=new HDRLoader(carga).load(new URL('./texturas/valle.hdr',import.meta.url).href,hdr=>{
    if(cerrado){hdr.dispose();return;}
    hdr.mapping=T.EquirectangularReflectionMapping;
    escena.environment=hdr;
    despertar();
  });
  texturas.add(entorno);
  const edificio=new T.Group();escena.add(edificio);
  const avanzar=construirInstalacion(edificio,materiales);
  const patio=new T.Group();escena.add(patio);
  const volar=crearGolondrinas(patio);
  let segundosAves=0, avesVisibles=false;
  const actualizarRecarga=crearRecarga(patio,carga,despertar);
  function luz(modo){
    if(cerrado || guiado || !['dia','noche','atardecer'].includes(modo))return;
    horaLibre=modo==='dia'?.25:1;
    anteriorAvance=-1;
    despertar();
  }
  // La parcela tiene relieve propio; en la distancia su borde se funde con el paisaje real.
  const sueloCostero={value:0};
  const ladera=materiales.lomas;
  const configurarLadera=ladera.onBeforeCompile.bind(ladera);
  ladera.transparent=true;ladera.depthWrite=false;
  ladera.onBeforeCompile=(shader,contexto)=>{
    configurarLadera(shader,contexto);shader.uniforms.sueloCostero=sueloCostero;
    shader.vertexShader='varying vec3 posicionLadera;\n'+shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n posicionLadera=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader='uniform float sueloCostero;varying vec3 posicionLadera;\n'+shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
        float distanciaCampo=length(posicionLadera.xz);
        float anguloSuelo=-normalize(posicionLadera-cameraPosition).y;
        float terrenoCercano=1.0-smoothstep(18.0,40.0,distanciaCampo);
        float inclinacion=smoothstep(.025,.12,anguloSuelo);
        float base=(1.-smoothstep(18.0,28.0,posicionLadera.z))*max(terrenoCercano,inclinacion);
        diffuseColor.a*=mix(base,1.,sueloCostero)*(1.-smoothstep(86.0,117.0,distanciaCampo));`
    );
  };
  edificio.traverse(pieza=>{if(pieza.material===ladera)pieza.renderOrder=-3;});
  const acabado=guiado?registrarAcabados(render,escena,edificio,ambiente.cielo,textura,patio):null;
  avanzar(avance);
  const controles=guiado?null:new OrbitControls(camara,canvas);
  if(controles){
    controles.enableDamping=true;controles.dampingFactor=.106;
    controles.enablePan=false;controles.minDistance=.83;controles.maxDistance=59;
    controles.minPolarAngle=.095;controles.maxPolarAngle=Math.PI*.495;
    controles.rotateSpeed=.59;controles.zoomSpeed=.83;
  }
  const amplitud=new T.Vector3();
  const desde=new T.Spherical(),hasta=new T.Spherical();
  let anchoActual=0,altoActual=0,hayGestos=false;
  function encuadre(id) {
    const ficha=VISTAS[id];
    const foco=new T.Vector3(...ficha.foco);
    const ojo=new T.Vector3(...ficha.ojo);
    const aspecto=camara.aspect;
    if(aspecto<1.22 && id!=='salon') ojo.sub(foco).multiplyScalar(Math.min(2.7,1.22/aspecto)).add(foco);
    return {ojo,foco};
  }
  function cambiar(id,inmediato=false) {
    if(guiado||cerrado||!Object.hasOwn(VISTAS,id)) return;
    ultimaVista=id;
    const {ojo,foco}=encuadre(id);
    if(inmediato||reducido.matches){
      viaje=null; camara.position.copy(ojo);controles.target.copy(foco);
      controles.update();
    } else {
      desde.setFromVector3(camara.position.clone().sub(controles.target));
      hasta.setFromVector3(ojo.sub(foco));
      const delta=T.MathUtils.euclideanModulo(hasta.theta-desde.theta+Math.PI,Math.PI*2)-Math.PI;
      viaje={origen:controles.target.clone(),foco,comienzo:performance.now(),giro:delta};
    }
    despertar();
  }
  function tamanio() {
    if(cerrado)return;
    const ancho=Math.max(1,contenedor.clientWidth),alto=Math.max(1,contenedor.clientHeight);
    if(ancho===anchoActual&&alto===altoActual)return;
    anchoActual=ancho;altoActual=alto;
    render.setSize(ancho,alto,false);camara.aspect=ancho/alto;camara.updateProjectionMatrix();

    if(!guiado && !hayGestos) cambiar(ultimaVista,true);
    despertar();
  }
  function prepararNave() {
    if (!preparandoNave) preparandoNave=import('./nave.js?v=fafacc8c4dac').then(({crearNave})=>{
      if(cerrado)return;
      nave=crearNave(render,entorno,despertar);
      despertar();
    }).catch(()=>{despertar();});
    return preparandoNave;
  }
  const enlace=guiado?crearEnlace(render):null;
  function dibujarCasa(p) {
    const reloj=progresoResidencial(p), vuelo=guiado?tiempoDron(p):0;
    const residencial=guiado?tiempoVilla(reloj):avance;
    if(vuelo>0) encuadrarDron(camara,vuelo,T.MathUtils.smoothstep(p,DESPEGUE,.846));
    else if(guiado) encuadrarResidencial(camara,reloj);
    sueloCostero.value=T.MathUtils.smoothstep(vuelo,0,.26);
    ambiente.costa(sueloCostero.value,segundosMar);
    avanzar(residencial);
    const horaSolar=guiado?residencial:horaLibre;
    avesVisibles=horaSolar<.78;
    volar(segundosAves,avesVisibles);
    if(horaSolar!==anteriorAvance){
      const noche=ambiente.aplicar(horaSolar);
      edificio.userData.actualizarVilla?.(noche,horaSolar);
      actualizarRecarga(noche,horaSolar);
      anteriorAvance=horaSolar;
    }
    ambiente.cielo.position.copy(camara.position);
    if(recursosListos) acabado?.actualizar(residencial,vuelo);
    render.render(escena,camara);
  }
  function dibujarEmpresas(p) {
    if(nave){
      // La nave abre a la mañana siguiente. Su exposición es independiente de la villa nocturna.
      const exposicionCasa=render.toneMappingExposure;
      render.toneMappingExposure=1.06;
      try{nave.dibujar(tiempoNave(p),camara.aspect,segundosMuelle/SEGUNDOS_MANIOBRA,tiempoParking(p));}
      finally{render.toneMappingExposure=exposicionCasa;}
    }
    canvas.style.opacity=nave?'1':'0';
  }
  function dibujar(hora) {
    frame=0;
    if(cerrado || !enPantalla || document.hidden)return;
    if(guiado && avance!==destino){
      const dt=Math.min(140,Math.max(12,hora-ultimoTiempo || 16.67));
      avance=Math.abs(destino-avance)<.00025?destino:T.MathUtils.lerp(avance,destino,1-Math.exp(-dt/62));
    }
    const segundos=Math.min(.1,Math.max(0,(hora-ultimoTiempo)/1000));
    ultimoTiempo=hora;
    if(avesVisibles && !reducido.matches)segundosAves+=segundos;
    const costa=guiado && avance<FIN_ENLACE && tiempoDron(avance)>.12;
    const muelles=guiado && nave && tiempoNave(avance)>=CORTE_MUELLES;
    if(costa && !reducido.matches)segundosMar+=segundos;
    segundosMuelle=muelles?Math.min(SEGUNDOS_MANIOBRA,segundosMuelle+segundos):0;
    if(viaje) {
      const t=Math.min(1,(hora-viaje.comienzo)/1150);
      const f=t*t*(3-2*t);
      controles.target.lerpVectors(viaje.origen,viaje.foco,f);
      const esfera=new T.Spherical(
        T.MathUtils.lerp(desde.radius,hasta.radius,f),
        T.MathUtils.lerp(desde.phi,hasta.phi,f),
        desde.theta+viaje.giro*f
      );
      camara.position.copy(amplitud.setFromSpherical(esfera)).add(controles.target);
      if(t===1)viaje=null;
    }
    const movido=controles?.update();
    if(guiado && avance>.66) prepararNave();
    if(guiado && nave && avance>=INICIO_EMPRESAS){
      avesVisibles=false;
      if(avance<FIN_ENLACE){
        dibujarCasa(avance);enlace.guardar();dibujarEmpresas(avance);
        enlace.mezclar(1-T.MathUtils.smootherstep(avance,INICIO_EMPRESAS,FIN_ENLACE));
      }else dibujarEmpresas(avance);
    }else {
      canvas.style.opacity='1';
      dibujarCasa(avance);
    }
    if(recursosListos&&!avisado){
      avisado=true;
      onListo?.();
    }
    if(movido||viaje||(guiado && avance!==destino))despertar();
    else if(!reducido.matches && (avesVisibles && recursosListos || costa || muelles && segundosMuelle<SEGUNDOS_MANIOBRA)){
      clearTimeout(esperaAmbiente);
      esperaAmbiente=setTimeout(despertar,avesVisibles?42:24);
    }
  }
  function despertar(){if(!frame&&!cerrado&&enPantalla&&!document.hidden)frame=requestAnimationFrame(dibujar);}
  function inicioGesto(){viaje=null;hayGestos=true;despertar();}
  controles?.addEventListener('start',inicioGesto);
  controles?.addEventListener('change',despertar);
  contenedor.appendChild(canvas);
  const resize=new ResizeObserver(tamanio);
  resize.observe(contenedor);
  const visibilidad=new IntersectionObserver(([e])=>{enPantalla=e.isIntersecting;if(enPantalla)despertar();});
  visibilidad.observe(contenedor);
  document.addEventListener('visibilitychange',despertar);
  function falloContexto(e){
    e.preventDefault();destruir();onError?.(new Error('El navegador ha liberado el contexto 3D.'));
  }
  canvas.addEventListener('webglcontextlost',falloContexto);
  function destruir() {
    if(cerrado)return;
    cerrado=true;cancelAnimationFrame(frame);clearTimeout(esperaAmbiente);resize.disconnect();visibilidad.disconnect();
    canvas.removeEventListener('webglcontextlost',falloContexto);
    document.removeEventListener('visibilitychange',despertar);
    controles?.removeEventListener('change',despertar);controles?.removeEventListener('start',inicioGesto);controles?.dispose();
    enlace?.destruir();nave?.destruir();actualizarRecarga.destruir();
    edificio.userData.destruirVilla?.();
    acabado?.destruir();
    const geometrias=new Set(),materialesUsados=new Set(Object.values(materiales));
    escena.traverse(obj=>{
      if(obj.geometry)geometrias.add(obj.geometry);
      if(obj.material){
        const lista=Array.isArray(obj.material)?obj.material:[obj.material];
        for(const mat of lista)materialesUsados.add(mat);
      }
      if(obj.isInstancedMesh)obj.dispose();
      if(obj.shadow)obj.shadow.dispose();
    });
    for(const geo of geometrias)geo.dispose();
    for(const mat of materialesUsados){
      for(const valor of Object.values(mat)) if(valor?.isTexture)texturas.add(valor);
      mat.dispose();
    }
    for(const tex of texturas)tex.dispose();
    ambiente.destruir();render.dispose();render.forceContextLoss();canvas.remove();
  }
  tamanio();
  onCambio?.('cubierta');
  return {
    vista(id){
      if(!Object.hasOwn(VISTAS,id)||cerrado)return;
      hayGestos=false;cambiar(id);onCambio?.(id);
    },
    progreso(valor,inmediato=false){
      if(cerrado||!Number.isFinite(valor))return;
      destino=T.MathUtils.clamp(valor,0,guiado?FIN_RECORRIDO:1);
      if(!guiado||inmediato||reducido.matches){
        avance=destino;
      }
      despertar();
      if(guiado && destino>.66) return prepararNave();
    },
    luz,destruir
  };
}
