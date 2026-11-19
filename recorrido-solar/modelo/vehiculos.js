import {GLTFLoader} from './vendor/GLTFLoader.js';
import {Matrix4,SRGBColorSpace} from './vendor/three.module.min.js';

// Recupera el detalle de pintura, lunas y llantas desde la toma calibrada. Al
// cambiar el ángulo vuelven a dominar los materiales físicos del vehículo.
export function proyectarAcabado(materiales,foto,camara){
  camara.updateMatrixWorld(true);
  const matriz=new Matrix4().multiplyMatrices(camara.projectionMatrix,camara.matrixWorldInverse);
  const intensidad={value:0};
  foto.colorSpace=SRGBColorSpace;
  for(const mat of materiales){
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{fotoCoche:{value:foto},camaraFoto:{value:matriz},ojoFoto:{value:camara.position},pesoFoto:intensidad});
      const variables='varying vec4 tomaCoche;varying vec3 mundoCoche;\n';
      shader.vertexShader=variables+'uniform mat4 camaraFoto;\n'+shader.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>\n mundoCoche=(modelMatrix*vec4(transformed,1.)).xyz;tomaCoche=camaraFoto*vec4(mundoCoche,1.);');
      shader.fragmentShader=variables+'uniform sampler2D fotoCoche;uniform vec3 ojoFoto;uniform float pesoFoto;\n'+shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
        if(pesoFoto>.001 && tomaCoche.w>.01){
          vec2 uv=tomaCoche.xy/tomaCoche.w*.5+.5;
          vec2 borde=min(uv,1.-uv);
          vec3 r=normalize(ojoFoto-mundoCoche);
          float afinidad=smoothstep(.93,.994,dot(r,normalize(cameraPosition-mundoCoche)));
          float cara=smoothstep(.01,.23,dot(inverseTransformDirection(normal,viewMatrix),r));
          float peso=pesoFoto*afinidad*cara*smoothstep(.003,.027,min(borde.x,borde.y));
          vec3 detalle=linearToOutputTexel(vec4(texture2D(fotoCoche,uv).rgb,1.)).rgb;
          gl_FragColor.rgb=mix(gl_FragColor.rgb,detalle,peso);
        }`);
    };
    mat.customProgramCacheKey=()=>'acabado-coche';
    mat.needsUpdate=true;
  }
  return intensidad;
}

// Los modelos están en metros, centrados entre ejes y con las ruedas a ras de suelo.
export function cargarVehiculo(padre,nombre,carga,alLlegar){
  let cerrado=false,vehiculo;
  function liberar(modelo){
    const materiales=new Set(),texturas=new Set(),geometrias=new Set();
    modelo.traverse(o=>{
      if(!o.isMesh)return;
      geometrias.add(o.geometry);
      for(const mat of [].concat(o.material))materiales.add(mat);
    });
    for(const mat of materiales){
      for(const valor of Object.values(mat))if(valor?.isTexture)texturas.add(valor);
      mat.dispose();
    }
    for(const textura of texturas)textura.dispose();
    for(const geometria of geometrias)geometria.dispose();
    modelo.removeFromParent();
  }
  new GLTFLoader(carga).load(new URL('./'+nombre+'.glb',import.meta.url).href,({scene})=>{
    if(cerrado){liberar(scene);return;}
    vehiculo=scene;
    scene.traverse(o=>{if(o.isMesh){o.castShadow=!o.material.transparent;o.receiveShadow=true;}});
    padre.add(scene);alLlegar(scene);
  });
  return ()=>{cerrado=true;if(vehiculo){liberar(vehiculo);vehiculo=null;}};
}
