import * as T from './vendor/three.module.min.js';

export const nivelMar=-2.55;
export const lineaCosta=x=>29+3.7*Math.sin(x*.073)+1.8*Math.sin(x*.19+.8)+.62*Math.sin(x*.44);

// El cielo y el agua miden el azimut en el mismo sistema. Las luces de la
// bahía conservan su reflejo aunque el dron cambie de altura o de rumbo.
export const coordenadasBahia=`
  vec2 direccionBahia(vec3 r) {
    float rumbo=atan(r.x,r.z);
    float cilindro=2.*atan(2.55*sin(rumbo*.5),cos(rumbo*.5));
    return vec2(.599-cilindro/6.2831853,.459+asin(clamp(r.y,-1.,1.))*.87);
  }`;

export function crearMar(escena,bahia,textura){
  const ondas=textura('ondulacion');ondas.wrapS=ondas.wrapT=T.RepeatWrapping;
  ondas.anisotropy=4;ondas.colorSpace=T.SRGBColorSpace;
  const posiciones=[],indices=[];
  for(let i=0;i<=240;i++){
    const s=(i-120)/120;
    const x=260*s+2300*Math.pow(s,5);
    posiciones.push(x,nivelMar,lineaCosta(x)-4.0,x,nivelMar,3600);
    if(i<240){const j=i*2;indices.push(j,j+1,j+2,j+2,j+1,j+3);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(posiciones,3));g.setIndex(indices);
  const material=new T.ShaderMaterial({
    uniforms:{bahia:{value:bahia},ondas:{value:ondas},reloj:{value:0},presencia:{value:0}},
    transparent:true,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec3 punto;void main(){punto=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(punto,1.);}',
    fragmentShader:`varying vec3 punto;uniform sampler2D bahia,ondas;uniform float reloj,presencia;
      ${coordenadasBahia}
      void main(){
        vec3 r=normalize(punto-cameraPosition);
        vec2 uv=direccionBahia(r);
        float distancia=length(punto-cameraPosition);
        vec2 q=punto.xz+vec2(.31*sin(punto.z*.12+reloj*.41),.24*cos(punto.x*.08-reloj*.35));
        float a=texture2D(ondas,q*vec2(.056,.075)+vec2(.004,-.012)*reloj).g;
        float b=texture2D(ondas,q.yx*vec2(.034,.027)+vec2(.003,.005)*reloj).g;
        float cresta=sqrt(a),rizo=sqrt(b);
        float m=clamp((cresta*.66+rizo*.34-.21)*5.,-.8,.8);
        float ola=sin(punto.z*.64+sin(punto.x*.20+reloj*.36)-reloj*.92)
                 +.32*sin(punto.x*.54+punto.z*.88+reloj*.74);
        float cerca=1.-smoothstep(160.,1400.,distancia);
        uv+=vec2(.002*ola+.0015*m,.004*ola+.0036*(cresta-rizo))*cerca;
        vec3 color=texture2D(bahia,vec2(uv.x,clamp(uv.y,.012,.458))).rgb;
        // Bajo el dron se ven las ondulaciones en la superficie del agua.
        float panorama=smoothstep(.018,.115,uv.y);
        vec3 fondo=vec3(.0024,.009,.019)+vec3(.012,.022,.033)*(cresta+rizo);
        color=mix(fondo,color,panorama)*(1.+cerca*(.34*m+.055*ola));
        float costa=29.+3.7*sin(punto.x*.073)+1.8*sin(punto.x*.19+.8)+.62*sin(punto.x*.44);
        float pie=abs(punto.z-costa-.45-.35*sin(punto.x*.46+reloj*.68));
        color+=vec3(.042,.061,.067)*(1.-smoothstep(.05,1.0,pie))*(.25+.7*a);
        gl_FragColor=vec4(color,presencia);
        #include <colorspace_fragment>
      }`
  });
  const mar=new T.Mesh(g,material);mar.renderOrder=-6;mar.visible=false;escena.add(mar);
  return (t,segundos)=>{mar.visible=t>.001;material.depthWrite=t>.97;material.uniforms.presencia.value=t;material.uniforms.reloj.value=segundos;};
}
