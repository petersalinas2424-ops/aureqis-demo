import * as T from './vendor/three.module.min.js';

// Compone dos tomas vivas del mismo instante de desplazamiento. Se conserva el
// color que realmente llegó a la pantalla, también en dispositivos con sRGB.
export function crearEnlace(render){
  const escena=new T.Scene(),camara=new T.Camera();
  const mezcla=new T.ShaderMaterial({
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{anterior:{value:null},peso:{value:1}},
    vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'varying vec2 coord;uniform sampler2D anterior;uniform float peso;void main(){gl_FragColor=vec4(texture2D(anterior,coord).rgb,peso);}'
  });
  const g=new T.PlaneGeometry(2,2),plano=new T.Mesh(g,mezcla);
  plano.frustumCulled=false;escena.add(plano);
  const tam=new T.Vector2();let copia;
  return {
    guardar(){
      render.getDrawingBufferSize(tam);
      if(!copia || copia.image.width!==tam.x || copia.image.height!==tam.y){
        copia?.dispose();copia=new T.FramebufferTexture(tam.x,tam.y);
        mezcla.uniforms.anterior.value=copia;
      }
      render.copyFramebufferToTexture(copia);
    },
    mezclar(peso){
      mezcla.uniforms.peso.value=peso;
      const auto=render.autoClear;render.autoClear=false;
      try{render.render(escena,camara);}finally{render.autoClear=auto;}
    },
    destruir(){copia?.dispose();mezcla.dispose();g.dispose();}
  };
}
