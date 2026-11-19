import * as T from './vendor/three.module.min.js';
import {encuadrarViaje,encuadrarResidencial} from './travelling.js';
import {encuadrarDron} from './dron.js';
import {tiempoDron} from './guion.js';

// Cada toma registra la misma geometría desde una cámara conocida, en un momento del día.
const registros = [['dia', 0], ['tejado', .34], ['pared', .705], ['noche', 1], ['patio', .677], ['costa', .803]];
const vertices = 'uniform mat4 tomaA,tomaB; varying vec4 clipA,clipB; varying vec3 lugarVilla;\n';
const situar = 'clipA=tomaA*puntoVilla;clipB=tomaB*puntoVilla;lugarVilla=puntoVilla.xyz;';
const fragmentos = `
  uniform sampler2D colorA,colorB,fondoA,fondoB;
  uniform vec2 intensidades;
  uniform float tomaNocturna,registroCosta;
  uniform vec3 ojoA,ojoB;
  varying vec4 clipA,clipB; varying vec3 lugarVilla;
  // El vehículo se dibuja en 3D. Evita proyectar su antigua silueta sobre la
  // fachada o el camino que quedan detrás en una fotografía de referencia.
  float fondoSinCoche(vec3 ojo){
    vec3 r=lugarVilla-ojo;
    vec3 inv=vec3(1.)/(r+vec3(.00001));
    vec3 a=(vec3(11.68,.025,.75)-ojo)*inv,b=(vec3(16.58,1.40,2.98)-ojo)*inv;
    vec3 cerca=min(a,b),lejos=max(a,b);
    float entrada=max(max(cerca.x,cerca.y),max(cerca.z,0.));
    float salida=min(min(lejos.x,lejos.y),min(lejos.z,1.));
    return 1.-smoothstep(0.,.20,(salida-entrada)*length(r));
  }
  vec4 detalleVilla(sampler2D foto,sampler2D distancia,vec4 clip) {
    vec3 ndc=clip.xyz/max(.001,clip.w);
    vec2 uv=ndc.xy*.5+.5;
    vec2 limite=min(uv,1.-uv);
    float borde=smoothstep(.002,.053,min(limite.x,limite.y))*step(.065,clip.w);
    float z=texture2D(distancia,uv).r;
    float metros=.065*170./(170.-z*(170.-.065));
    float tolerancia=.08+.009*clip.w;
    float visible=1.-smoothstep(tolerancia,tolerancia*3.,abs(clip.w-metros));
    return vec4(texture2D(foto,uv).rgb,visible*borde);
  }
`;
const aplicar = `
  if(intensidades.x+intensidades.y>.005){
    vec4 da=detalleVilla(colorA,fondoA,clipA);
    vec4 db=detalleVilla(colorB,fondoB,clipB);
    vec2 pesos=vec2(da.a*fondoSinCoche(ojoA),db.a*fondoSinCoche(ojoB))*intensidades;
    // En la pared de equipos la iluminación física conserva una sola sombra al rodear el patio.
    float pared=smoothstep(7.86,7.99,lugarVilla.x)*(1.-smoothstep(8.30,8.55,lugarVilla.x));
    float bajoAlero=1.-smoothstep(2.87,3.36,lugarVilla.y);
    pesos.y*=1.-tomaNocturna*pared*bajoAlero;
    float jardin=1.-smoothstep(12.,16.,max(abs(lugarVilla.x),abs(lugarVilla.z)));
    pesos.y*=mix(1.,jardin,registroCosta);
    float suma=pesos.x+pesos.y;
    vec3 foto=linearToOutputTexel(vec4((da.rgb*pesos.x+db.rgb*pesos.y)/max(.001,suma),1.)).rgb;
    #if defined(STANDARD) && defined(USE_SHADOWMAP) && (NUM_DIR_LIGHT_SHADOWS > 0)
      DirectionalLightShadow focoReal=directionalLightShadows[0];
      float luzActual=getShadow(directionalShadowMap[0],focoReal.shadowMapSize,
        focoReal.shadowIntensity,focoReal.shadowBias,focoReal.shadowRadius,vDirectionalShadowCoord[0]);
      if(receiveShadow) foto*=mix(.77,1.,luzActual);
    #endif
    gl_FragColor.rgb=mix(gl_FragColor.rgb,foto,min(.96,suma));
  }
`;

export function registrarAcabados(render, escena, edificio, cielo, cargar, patio) {
  if (render.capabilities.maxTextures < 12) return null;
  const camara = new T.PerspectiveCamera(36,16/9,.065,170);
  const dinamicos = new Set(), materiales = new Set(), ocultar = new Set([patio]);
  edificio.traverse(obj => {
    if (!obj.isMesh) return;
    if(obj.userData.mobiliario){
      ocultar.add(obj);
    } else if (obj.instanceMatrix?.usage === T.DynamicDrawUsage) {
      dinamicos.add(obj.material);
      ocultar.add(obj);
    } else if (obj.isReflector || obj.material.userData.orden || obj.material.isMeshPhysicalMaterial && obj.material.transparent) {
      ocultar.add(obj);
    } else {
      materiales.add(obj.material);
    }
  });
  const tomas = registros.map(([nombre,p]) => {
    camara.aspect=['patio','costa'].includes(nombre)?1.6:16/9;
    if(nombre==='patio') encuadrarResidencial(camara,p);
    else if(nombre==='costa') encuadrarDron(camara,tiempoDron(p));
    else encuadrarViaje(camara,p);
    // Las dos fotografías generales se tomaron con el encuadre anterior al último ajuste editorial.
    if(p===0 || p===1) camara.projectionMatrix.elements[8]=-.27;
    camara.updateMatrixWorld(true);
    const objetivo = new T.WebGLRenderTarget(768,432);
    objetivo.depthTexture = new T.DepthTexture(768,432,T.UnsignedIntType);
    const foto = cargar(nombre==='patio'?'berlina-en-carga':'villa-'+nombre);
    foto.colorSpace=T.SRGBColorSpace;
    return {camara:camara.clone(), objetivo, foto,
      pv:new T.Matrix4().multiplyMatrices(camara.projectionMatrix,camara.matrixWorldInverse)};
  });
  const u = {
    tomaA:{},tomaB:{},colorA:{},colorB:{},fondoA:{},fondoB:{},ojoA:{},ojoB:{},
    intensidades:{value:new T.Vector2()},tomaNocturna:{value:0},registroCosta:{value:0}
  };
  let listo=false, tramo=-1;
  function asociar(inicio){
    if(inicio===tramo) return;
    tramo=inicio;
    u.tomaNocturna.value=inicio===2?1:0;u.registroCosta.value=inicio===4?1:0;
    for(const [i,letra] of [[inicio,'A'],[inicio+1,'B']]){
      const toma=tomas[i];u['toma'+letra].value=toma.pv;
      u['ojo'+letra].value=toma.camara.position;
      u['color'+letra].value=toma.foto;u['fondo'+letra].value=toma.objetivo.depthTexture;
    }
  }
  asociar(0);
  function integrar(mat){
    const previo=mat.onBeforeCompile.bind(mat), clave=mat.customProgramCacheKey();
    mat.onBeforeCompile=(shader,motor)=>{
      previo(shader,motor);
      Object.assign(shader.uniforms,u);
      const local=`vec4 puntoVilla=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          puntoVilla=instanceMatrix*puntoVilla;
        #endif
        puntoVilla=modelMatrix*puntoVilla;`;
      shader.vertexShader = vertices+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\n'+local+'\n'+situar);
      // El mapa sRGB se descodifica en la GPU y se lleva al espacio del destino, también en el espejo.
      shader.fragmentShader=fragmentos+shader.fragmentShader.replace('#include <colorspace_fragment>','#include <colorspace_fragment>\n'+aplicar);
    };
    mat.customProgramCacheKey=()=>clave+'/acabado-villa';
    mat.needsUpdate=true;
  }
  function calibrar() {
    const destino=render.getRenderTarget(), auto=render.shadowMap.autoUpdate;
    const posicion=cielo.position.clone(), escribe=new Map();
    const visibilidad=new Map([...ocultar].map(obj=>[obj,obj.visible]));
    try {
      ocultar.forEach(obj=>{obj.visible=false;});
      materiales.forEach(mat=>{escribe.set(mat,mat.depthWrite);mat.depthWrite=true;});
      render.shadowMap.autoUpdate=false;
      for(const toma of tomas){
        cielo.position.copy(toma.camara.position);
        render.setRenderTarget(toma.objetivo);render.render(escena,toma.camara);
      }
    } finally {
      render.setRenderTarget(destino);render.shadowMap.autoUpdate=auto;
      cielo.position.copy(posicion);
      visibilidad.forEach((visible,obj)=>{obj.visible=visible;});
      escribe.forEach((v,mat)=>{mat.depthWrite=v;});
    }
    materiales.forEach(mat=>{if(!dinamicos.has(mat)) integrar(mat);});
    listo=true;
  }
  return {
    actualizar(p,vuelo=0){
      if(!listo) calibrar();
      const t=T.MathUtils.smoothstep;
      if(p<.53){
        asociar(0);const k=t(p,.055,.29);u.intensidades.value.set(.96*(1-k),.88*k);
      } else if(p<.88){
        asociar(1);const k=t(p,.54,.665);u.intensidades.value.set(.88*(1-k),.75*k*(1-t(p,.747,.87)));
      } else if(p>.90 && p<.972) {
        asociar(3);
        const cerca=t(p,.90,.928)*(1-t(p,.95,.972));
        u.intensidades.value.set((1-cerca)*.96*t(p,.91,.992),cerca*.96);
      } else {
        asociar(2);u.intensidades.value.set(0,.96*t(p,.91,.992));
      }
      if(vuelo>.33){
        asociar(4);
        u.intensidades.value.set(0,.96*t(vuelo,.33,.78));
      }else u.intensidades.value.multiplyScalar(1-t(vuelo,.04,.33));
    },
    destruir(){for(const toma of tomas)toma.objetivo.dispose();}
  };
}
