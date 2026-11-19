import * as T from './vendor/three.module.min.js';

export function aleatorio(semilla = 5931) {
  return () => {
    semilla = (Math.imul(1664525, semilla) + 1013904223) >>> 0;
    return semilla / 4294967296;
  };
}

function pintar(ancho, alto, dibujar) {
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  dibujar(lienzo.getContext('2d'));
  const textura = new T.CanvasTexture(lienzo);
  textura.colorSpace = T.SRGBColorSpace;
  return textura;
}

function cristalSolar() {
  return pintar(512, 768, ctx => {
    const azar = aleatorio();
    ctx.fillStyle = '#394651';
    ctx.fillRect(0, 0, 512, 768);
    for (let fila = 0; fila < 12; fila++) {
      for (let col = 0; col < 6; col++) {
        const x = 3 + col * 84.45;
        const y = 3 + fila * 63.55;
        const w = 82.9, h = 61.6;
        const luz = Math.round(azar() * 9);
        const grad = ctx.createLinearGradient(x, y, x+w, y+h);
        grad.addColorStop(0, 'rgb('+(17+luz)+','+(28+luz)+','+(44+luz)+')');
        grad.addColorStop(1, 'rgb('+(9+luz)+','+(21+luz)+','+(39+luz)+')');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x+3, y); ctx.lineTo(x+w-3,y); ctx.lineTo(x+w,y+3);
        ctx.lineTo(x+w,y+h-3); ctx.lineTo(x+w-3,y+h); ctx.lineTo(x+3,y+h);
        ctx.lineTo(x,y+h-3); ctx.lineTo(x,y+3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(157,183,190,.25)'; ctx.lineWidth = .48;
        ctx.beginPath();
        for (let i=1; i<38;i++) {
          const yy=y+h*i/38;
          ctx.moveTo(x+2,yy);ctx.lineTo(x+w-2,yy);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(188,193,192,.52)';
        for (let i=1;i<6;i++) ctx.fillRect(x+w*i/6,y+1,.75,h-2);
      }
    }
  });
}

export function crearMateriales(cargar, anisotropia) {
  const mapa=(archivo,rx=1,ry=1,color=true)=>{
    const tex=cargar(archivo);
    tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(rx,ry);
    if(color) tex.colorSpace=T.SRGBColorSpace;
    tex.anisotropy=anisotropia;
    return tex;
  };
  const mate=(color,extras={})=>new T.MeshStandardMaterial({color,roughness:.84,...extras});
  const madera=mapa('carpinteria',1,1);
  const celulas=cristalSolar();
  celulas.anisotropy=anisotropia;
  const monte=pintar(116,96,ctx=>{
    const rng=aleatorio(138);
    ctx.fillStyle='#635c49';ctx.fillRect(55,44,4,44);
    for(let i=0;i<15;i++){
      const a=i*2.399,radio=Math.sqrt(rng())*25;
      const x=57+Math.cos(a)*radio*1.06,y=39+Math.sin(a)*radio*.57;
      ctx.strokeStyle='#726e55';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(57,70);ctx.lineTo(x,y);ctx.stroke();
      for(let j=0;j<64;j++){
        const b=rng()*6.283,s=Math.sqrt(rng());
        ctx.fillStyle=['#75805c','#778166','#68795f','#82916b','#869473','#8e9775'][Math.floor(rng()*6)];
        ctx.beginPath();ctx.arc(x+Math.cos(b)*s*17,y+Math.sin(b)*s*13,1.7+rng()*3.3,0,6.283);ctx.fill();
      }
    }
  });
  const suelo=mate('#f4ebd6',{map:mapa('tierra-pedregosa',9.5,9.5),bumpMap:mapa('grano',26,26,false),bumpScale:.016,transparent:true,vertexColors:true,depthWrite:false});
  suelo.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb *= mix(0.79, 1.21, texture2D(bumpMap, vBumpMapUv).r);');
  };
  return {
    estuco:mate('#fffef9',{map:mapa('estuco',3,1.3),normalMap:mapa('estuco-relieve',3,1.3,false),normalScale:new T.Vector2(.26,.26)}),
    piedra:mate('#c5b18e',{bumpMap:mapa('grano',4,1,false),bumpScale:.002}),
    suelo, lomas:mate('#fffbe6',{map:mapa('pastizal',19,19),vertexColors:true}),
    monte:mate('#b6b598',{map:monte,alphaTest:.38,side:T.DoubleSide}),
    madera:mate('#a68468',{map:madera}), maderaClara:mate('#c6a382',{map:madera}),
    lino:mate('#d6c5a9',{bumpMap:mapa('grano',6,4,false),bumpScale:.0008,roughness:.96}),
    aluminio:mate('#acb9ba',{metalness:.76,roughness:.34}),
    perfil:mate('#363e42',{metalness:.63,roughness:.37}),
    cristal:new T.MeshPhysicalMaterial({map:celulas,color:0xffffff,metalness:.27,roughness:.22,clearcoat:.92,clearcoatRoughness:.095,envMapIntensity:.95}),
    bateria:mate('#e8e9e3',{metalness:.27,roughness:.4}),
    junta:mate('#272c29',{roughness:.8}), chapa:mate('#64716b',{metalness:.61,roughness:.45}),
    tubo:mate('#a7ada3',{metalness:.65,roughness:.36}), aislador:mate('#a55338',{roughness:.59}),
    led:new T.MeshBasicMaterial({color:'#92c578'}), cable:mate('#35362f'),
    corteza:mate('#b4a58a',{map:mapa('corteza',1,1.3),roughness:1}),
    hojas:new T.MeshStandardMaterial({map:mapa('olivo-rama'),alphaTest:.38,side:T.DoubleSide,color:'#b5c5a3',roughness:1}),
    aciculas:mate('#e4ebd9',{map:mapa('pino-rama'),alphaTest:.31,side:T.DoubleSide}),
    herbazal:mate('#ffffff',{vertexColors:true,side:T.DoubleSide}), caliza:mate('#92816a',{roughness:1}),
    pantalla:new T.MeshBasicMaterial({color:'#4a725d'})
  };
}
