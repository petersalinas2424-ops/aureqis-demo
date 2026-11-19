import * as T from './vendor/three.module.min.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';

const ejeDelantero=2.67,alturaEje=.628,radioPaso=.625;

// La planta lateral incluye el arco real del neumático. La extrusión cierra
// ambos costados, el techo y los bajos con la misma arista biselada.
function carroceria(){
  const perfil=new T.Shape();
  const punto=(z,y)=>perfil.lineTo(-z,y);
  perfil.moveTo(-1.38,.27);
  const abertura=radioPaso+.045;
  punto(ejeDelantero-abertura,.27);
  for(let i=0;i<=32;i++){
    const a=Math.PI*(1-i/32);
    punto(ejeDelantero+abertura*Math.cos(a),alturaEje+abertura*Math.sin(a));
  }
  punto(ejeDelantero+abertura,.27);
  for(const [z,y] of [[4.07,.27],[4.13,.37],[4.12,1.47],[4.08,2.00],[3.99,2.23],
    [3.87,3.04],[3.90,3.13],[3.85,3.25],[3.75,3.47],[3.64,3.58],
    [3.45,3.69],[3.22,3.74],[2.76,3.78],[2.29,3.86],[1.93,3.93],[1.40,3.94],
    [1.36,3.74],[1.35,3.20],[1.34,2.06],[1.37,.93]])punto(z,y);
  perfil.closePath();
  const bisel=.045;
  const g=new T.ExtrudeGeometry(perfil,{depth:2,bevelEnabled:true,bevelThickness:.055,
    bevelSize:bisel,bevelSegments:4,steps:1});
  g.translate(0,0,-1);g.rotateY(Math.PI/2);
  const pos=g.attributes.position;
  for(let i=0;i<pos.count;i++){
    const y=pos.getY(i);
    const ancho=1.246-.075*T.MathUtils.smoothstep(y,1.68,2.45)-.084*T.MathUtils.smoothstep(y,3.35,4.);
    pos.setX(i,pos.getX(i)*ancho/1.055);
  }
  g.computeVertexNormals();return g;
}

// El guardabarros tiene fondo y pared interior. La banda exterior sigue el
// mismo centro que la rueda, también cuando gira la dirección.
function pasoDeRueda(lado){
  const p=[],indices=[];
  const perfil=[[.84,radioPaso+.015],[1.18,radioPaso+.015],[1.265,radioPaso+.023],[1.267,radioPaso+.078]];
  for(let i=0;i<=40;i++){
    const a=Math.PI*i/40;
    for(const [x,r] of perfil)p.push(lado*x,alturaEje+r*Math.sin(a),ejeDelantero+r*Math.cos(a));
    if(i)for(let j=0;j<perfil.length-1;j++){
      const k=(i-1)*perfil.length+j;
      indices.push(k,k+1,k+4,k+1,k+5,k+4);
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);
  g.computeVertexNormals();return g;
}

export function crearManiobra(escena,{geo,mat,textura,lotear,estacionados=[]}){
  const tractor=new T.Group(),remolque=new T.Group();escena.add(tractor,remolque);
  const curvo=geo(new RoundedBoxGeometry(1,1,1,2,.09));
  const plano=geo(new T.PlaneGeometry()),eje=geo(new T.CylinderGeometry(1,1,1,32));
  const caucho=mat('#232426',{roughness:.88}),bastidor=mat('#303536',{roughness:.59,metalness:.26});
  const acero=mat('#a4abad',{roughness:.36,metalness:.66}),aluminio=mat('#c7cdcc',{roughness:.48,metalness:.57});
  const esmalte=mat('#7a8878',{roughness:.36,metalness:.39});
  const piloto=mat('#b73523',{emissive:'#a82112',emissiveIntensity:.3});
  const marchaAtras=mat('#f6f0d9',{emissive:'#fff2cf',emissiveIntensity:.60});
  const vidrio=mat('#434c4f',{roughness:.15,metalness:.7}),marfil=mat('#e0dfd6',{roughness:.79});
  const cabina=mat('#828d79',{roughness:.52,metalness:.22});
  const frente=textura('tractora-frente'),lado=textura('tractora-lado');
  for(const t of [frente,lado])t.wrapS=t.wrapT=T.ClampToEdgeWrapping;
  cabina.onBeforeCompile=function(s){
    s.uniforms.tonoChapa={value:this.color};
    Object.assign(s.uniforms,{pielFrente:{value:frente},pielLado:{value:lado}});
    s.vertexShader='varying vec3 puntoCabina,normalCabina;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n puntoCabina=position;normalCabina=normal;');
    s.fragmentShader='varying vec3 puntoCabina,normalCabina;uniform sampler2D pielFrente,pielLado;uniform vec3 tonoChapa;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 n=normalize(normalCabina);
      float yFoto=(puntoCabina.y-.22)/3.78;
      vec2 uvF=vec2(puntoCabina.x/2.52+.5,yFoto);
      float arco=1.-smoothstep(.49,.73,abs(puntoCabina.z-2.67));
      vec2 uvL=vec2((puntoCabina.z-1.30)/2.88,yFoto-.029*arco*(1.-smoothstep(1.22,1.65,puntoCabina.y)));
      // El faro pertenece al frontal. Su extremo vuelve por el costado hasta
      // el estribo; la segunda fotografía sólo aporta la chapa que lo rodea.
      float paragolpes=1.-smoothstep(1.55,1.92,puntoCabina.y);
      uvL.x=mix(uvL.x,min(uvL.x,.885),paragolpes);
      uvF.x=clamp(uvF.x,.025,.975);
      vec4 f=texture2D(pielFrente,clamp(uvF,.006,.994)),l=texture2D(pielLado,clamp(uvL,.006,.994));
      float retorno=smoothstep(3.92,4.115,puntoCabina.z)*paragolpes;
      l=mix(l,f,retorno);
      float morro=smoothstep(.12,.84,n.z)*(1.-smoothstep(.6,.91,n.y));
      float costado=smoothstep(.08,.84,abs(n.x));
      vec2 mezcla=vec2(morro*f.a,costado*l.a);
      float suma=mezcla.x+mezcla.y;
      vec3 pintura=mix(diffuseColor.rgb,(f.rgb*mezcla.x+l.rgb*mezcla.y)/max(suma,.0001),min(suma,1.));
      // Recolorea sólo la pintura oliva, conservando lunas, faros y calandra.
      float pigmento=smoothstep(.003,.045,pintura.g-pintura.b)*smoothstep(.045,.22,dot(pintura,vec3(.21,.72,.07)));
      diffuseColor.rgb=mix(pintura,pintura*tonoChapa/vec3(.223,.266,.191),pigmento*smoothstep(.05,.9,suma));
    `);
  };
  const piel=new T.Mesh(geo(carroceria()),cabina);piel.castShadow=true;tractor.add(piel);
  const interiorPaso=mat('#2e3231',{roughness:.93,side:T.DoubleSide});
  for(const signo of [-1,1]){
    const paso=new T.Mesh(geo(pasoDeRueda(signo)),interiorPaso);
    paso.castShadow=true;paso.receiveShadow=true;tractor.add(paso);
  }
  const sombraContacto=new T.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:'varying vec2 coord;void main(){coord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 coord;void main(){vec2 d=abs(coord*2.-1.);float borde=(1.-smoothstep(.48,1.,d.x))*(1.-smoothstep(.65,1.,d.y));gl_FragColor=vec4(.047,.045,.04,.23*borde);}'
  });
  for(const [grupo,z,ancho,largo] of [[tractor,1.55,3.07,5.6],[remolque,0,3.12,10.8]]){
    const penumbra=new T.Mesh(plano,sombraContacto);
    penumbra.rotation.x=-Math.PI/2;penumbra.scale.set(ancho,largo,1);penumbra.position.set(0,.085,z);
    grupo.add(penumbra);
  }
  const lt=lotear(tractor),lr=lotear(remolque);
  const caj=(l,m,x,y,z,w,h,d,g=0)=>l.poner(curvo,m,x,y,z,w,h,d,0,0,g);
  // La quinta rueda une físicamente las dos partes en el origen de la tractora.
  caj(lt,bastidor,0,.83,1.35,1.49,.32,5.20);
  lt.poner(eje,bastidor,0,1.28,0,.54,.15,.62);
  // Junta y tapa de la claraboya, asentadas sobre la pendiente real del techo.
  lt.poner(curvo,bastidor,0,3.833,2.72,.88,.041,.66,.153);
  lt.poner(curvo,esmalte,0,3.856,2.722,.84,.052,.62,.153);
  for(const s of [-1,1]){
    caj(lt,acero,s*.96,.80,.85,.56,.68,1.03);
    for(const z of [.52,1.16])caj(lt,bastidor,s*1.242,.81,z,.021,.63,.055);
    // Fondo opaco detrás de la rueda, remates de los estribos y anclajes del retrovisor.
    caj(lt,interiorPaso,s*.825,.82,ejeDelantero,.12,.90,1.32);
    caj(lt,bastidor,s*1.247,.51,3.75,.05,.055,.50);
    caj(lt,bastidor,s*1.239,.82,3.74,.05,.048,.48);
    caj(lt,bastidor,s*1.275,2.76,3.63,.36,.062,.085);
    caj(lt,bastidor,s*1.275,2.37,3.63,.36,.045,.070);
    caj(lt,bastidor,s*1.425,2.56,3.62,.15,.47,.22);
    caj(lt,vidrio,s*1.426,2.55,3.51,.109,.34,.025);
    caj(lt,esmalte,s*1.12,1.21,-.06,.41,.10,1.33);
  }
  const reflectante=mat('#dcb75d',{roughness:.47,metalness:.29});
  const gomaPuerta=mat('#353a38',{roughness:.84});
  const lona=mat('#f2f0e8',{map:textura('lona-camion'),roughness:.85});
  caj(lr,bastidor,0,.92,0,1.60,.24,10.52);
  caj(lr,marfil,0,2.86,0,2.55,2.82,10.71);
  caj(lr,gomaPuerta,0,2.85,-5.367,.035,2.72,.021);
  caj(lr,aluminio,0,.56,-5.11,2.34,.15,.16);
  for(const s of [-1,1]){
    for(const altura of [1.67,2.80,3.92])caj(lr,acero,s*1.16,altura,-5.38,.22,.068,.035);
    for(let z=-4.85;z<5.25;z+=.59)caj(lr,reflectante,s*1.32,1.47,z,.014,.049,.49);
    lr.poner(plano,lona,s*1.281,2.86,0,10.68,2.75,1,0,s*Math.PI/2);
    for(const y of [1.45,4.29])caj(lr,aluminio,s*1.284,y,0,.06,.095,10.78);
    for(const z of [-5.31,5.31])caj(lr,aluminio,s*1.284,2.86,z,.06,2.82,.10);
    for(let z=-4.89;z<=5;z+=.83){
      caj(lr,bastidor,s*1.311,1.66,z,.042,.28,.055);
      caj(lr,acero,s*1.337,1.59,z,.021,.095,.09);
    }
    for(const y of [.64,.88])caj(lr,aluminio,s*1.18,y,1.67,.095,.115,4.26);
    caj(lr,bastidor,s*.83,1.12,3.25,.14,.54,.16);
    caj(lr,bastidor,s*.83,.84,3.25,.30,.07,.28);
    caj(lr,piloto,s*.99,.96,-5.39,.41,.15,.05);
    caj(lr,marchaAtras,s*.67,.95,-5.39,.16,.12,.05);
    caj(lr,acero,s*.66,2.82,-5.375,.042,2.61,.05);
  }
  lt.terminar();lr.terminar();
  // Una rueda compartida con aro, orificios y tornillos. El dibujo gira con el eje.
  const plantilla=new T.Group(),rueda=lotear(plantilla);
  const disco=(m,x,y,z,r,an)=>rueda.poner(eje,m,x,y,z,r,an,r,0,0,Math.PI/2);
  disco(caucho,0,0,0,.548,.33);disco(acero,.165,0,0,.371,.025);
  disco(bastidor,.181,0,0,.304,.022);disco(aluminio,.196,0,0,.245,.028);
  disco(acero,.220,0,0,.118,.051);
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5;
    disco(caucho,.184,.321*Math.sin(a),.321*Math.cos(a),.036,.028);
    disco(bastidor,.217,.17*Math.sin(a),.17*Math.cos(a),.023,.022);
  }
  rueda.terminar();
  const ruedas=[];
  for(const [padre,zs] of [[remolque,[-4.02,-2.85,-1.68]],[tractor,[-.07,ejeDelantero]]]){
    for(const z of zs)for(const s of [-1,1]){
      const direccion=new T.Group(),rodante=plantilla.clone();
      direccion.position.set(s*1.105,alturaEje,z);padre.add(direccion);direccion.add(rodante);
      rodante.rotation.y=s<0?Math.PI:0;ruedas.push({rodante,direccion,delantera:padre===tractor&&z>2,s});
    }
  }
  plantilla.traverse(o=>{if(o.isInstancedMesh)o.dispose();});
  function situar(t){
    const u=1-T.MathUtils.smootherstep(t,0,1),distancia=9.2*u;
    const desplazamiento=3.24*u**3;
    const pendiente=9.72*u*u/9.2,angulo=Math.atan(pendiente);
    const curvatura=19.44*u/(9.2**2*Math.pow(1+pendiente*pendiente,1.5));
    const giro=angulo+Math.atan(7.13*curvatura);
    // El eje triple describe la curva. El pivote está 7,13 m por delante de él.
    const x=-23.8+desplazamiento,z=25.58+distancia;
    remolque.rotation.y=angulo;tractor.rotation.y=giro;
    remolque.position.set(x+2.85*Math.sin(angulo),0,z+2.85*Math.cos(angulo));
    tractor.position.set(x+7.13*Math.sin(angulo),0,z+7.13*Math.cos(angulo));
    for(const {rodante,direccion,delantera,s} of ruedas){
      rodante.rotation.order='YXZ';rodante.rotation.x=s*distancia/.548;
      direccion.rotation.y=delantera?.27*Math.sin(u*Math.PI):0;
    }
  }
  // Los vehículos aparcados comparten la misma geometría rígida. Las matrices
  // se hornean en metros, también para las piezas instanciadas de cada rueda.
  const flota=new T.Group(),lotes=lotear(flota);
  for(const [x,z,color] of estacionados){
    const pintura=mat(color,{roughness:.39,metalness:.24});
    pintura.onBeforeCompile=cabina.onBeforeCompile;
    for(const [grupo,enganche] of [[remolque,0],[tractor,4.28]]){
      grupo.updateWorldMatrix(true,true);
      const origen=new T.Matrix4().makeTranslation(x,0,z+enganche);
      grupo.traverse(pieza=>{
        if(!pieza.isMesh || pieza.material===sombraContacto)return;
        const material=pieza.material===cabina?pintura:pieza.material;
        const base=new T.Matrix4().multiplyMatrices(origen,pieza.matrixWorld);
        if(!pieza.isInstancedMesh){lotes.ponerMatriz(pieza.geometry,material,base);return;}
        const local=new T.Matrix4(),mundo=new T.Matrix4();
        for(let i=0;i<pieza.count;i++){
          pieza.getMatrixAt(i,local);
          lotes.ponerMatriz(pieza.geometry,material,mundo.multiplyMatrices(base,local));
        }
      });
    }
  }
  lotes.terminar();escena.add(flota);
  situar(0);
  return {situar,mostrarEn(destino){
    if(tractor.parent!==destino)destino.add(tractor,remolque,flota);
  },destruir(){sombraContacto.dispose();}};
}
