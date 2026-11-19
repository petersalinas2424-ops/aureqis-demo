import {tiempoVilla, progresoResidencial, FIN_LLEGADA, INICIO_PLACAS_NAVE, faseCubierta, INICIO_PARKING, DURACION_PARKING, FIN_RECORRIDO, tiempoParking} from './modelo/guion.js?v=4123164f6cc5';
const revision = new URL(import.meta.url).search;
const recurso = ruta => new URL(ruta, import.meta.url).href + revision;

export function iniciarPortada(raiz) {
  const controlador = new AbortController();
  const {signal} = controlador;
  const $ = (selector, parent = raiz) => parent.querySelector(selector);
  const $$ = (selector, parent = raiz) => [...parent.querySelectorAll(selector)];
  const reducido = matchMedia('(prefers-reduced-motion: reduce)');
  const limite = valor => Math.max(0, Math.min(1, valor));


  const cabecera = $('#cabecera');
  const menu = $('.menu-btn');
  function abrirMenu(abierto) {
    cabecera.classList.toggle('menu-abierto', abierto);
    menu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    $('use', menu).setAttribute('href', abierto ? '#i-close' : '#i-menu');
  }
  menu?.addEventListener('click', () => abrirMenu(menu.getAttribute('aria-expanded') === 'false'));
  $$('.nav a').forEach(enlace => enlace.addEventListener('click', () => abrirMenu(false)));
  raiz.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && cabecera?.classList.contains('menu-abierto')) {
      abrirMenu(false);
      menu.focus();
    }
  });

  const vistas = {
    salon:{imagen:'modelo/salon.webp',detalle:'El salón y el comedor se abren a la terraza.'},
    terraza:{imagen:'modelo/terraza.webp',detalle:'Junto a la piscina hay un rincón de lectura a la sombra.'},
    cubierta:{imagen:'modelo/etapa-7.webp', detalle:'La orientación, las sombras y la superficie disponible marcan el diseño de la instalación.'},
    panel:{imagen:'modelo/etapa-3.webp', detalle:'Las células del módulo producen corriente continua. El marco y los carriles mantienen el conjunto sujeto al tejado.'},
    recarga:{imagen:'modelo/etapa-6.webp', detalle:'El cable conecta el punto de recarga del patio con la toma del coche.'},
    bateria:{imagen:'modelo/etapa-5.webp', detalle:'El almacenamiento permite utilizar más tarde parte de la producción solar. La capacidad se elige según tus horarios y tu consumo.'}
  };
  const peliculaInfo = {
    vivienda:['Sobre teja, en Motril','Dos vistas aéreas de una instalación residencial del archivo de Aureqis. Vídeo sin sonido.'],
    industria:['Una nave desde el aire','Dos perspectivas de una cubierta industrial equipada con paneles. Vídeo sin sonido.'],
    montaje:['Manos en la cubierta','El equipo coloca un módulo fotovoltaico sobre la estructura. Vídeo sin sonido.']
  };
  let promesaModulo;
  function cargarModulo() {
    if (!promesaModulo) promesaModulo = import('./modelo/visor.js?v=4123164f6cc5').catch(error => { promesaModulo = null; throw error; });
    return promesaModulo;
  }
  const etapas = [
    {inicio:0, punto:0, nombre:'La villa', titulo:['Placas solares','y aerotermia.'], subrayado:'Placas solares', texto:'Instalamos en viviendas y empresas. Recorre esta casa para ver cómo se montan las placas y dónde se usa la energía que producen.'},
    {inicio:.043, punto:.125, nombre:'La estructura', titulo:['La base','de las placas.'], texto:'Fijamos los carriles al tejado. Sobre ellos se sujetan los paneles, con espacio por debajo para que circule el aire.'},
    {inicio:.144, punto:.273, nombre:'Las placas solares', titulo:['Electricidad','en tu tejado.'], texto:'Con luz de día, las células de los paneles producen corriente continua. El cableado la lleva hasta el inversor.'},
    {inicio:.298, punto:.375, nombre:'El inversor', titulo:['Del tejado','al enchufe.'], subrayado:'al enchufe', texto:'El inversor convierte esa corriente en la que utilizan la nevera, el horno o el aire acondicionado.'},
    {inicio:.383, punto:.476, nombre:'La batería', titulo:['Energía para','después.'], texto:'Cuando las placas producen más de lo que la casa necesita, la batería puede guardar el excedente.'},
    {inicio:.487, punto:.555, nombre:'El punto de recarga', titulo:['El coche carga','en casa.'], texto:'Desde el punto de recarga del patio puedes programar la carga para las horas en que el coche está aparcado y hay sol.'},
    {inicio:.609, punto:.650, nombre:'La villa de noche', titulo:['La casa,','de noche.'], texto:'La batería puede alimentar las luces del salón y la terraza con la energía que se guardó durante el día.'},
    {inicio:.678, punto:.798, nombre:'La costa', titulo:['Al otro lado,','el mar.'], texto:'Desde la terraza se ven las luces de la costa. Al amanecer nos acercamos a la cubierta de una nave.'},
    {inicio:.844, punto:.8733, nombre:'La nave industrial', titulo:['Del carril','a la placa.'], subrayado:'carril', texto:'Sobre la chapa fijamos las grapas. Los dos carriles de aluminio bajan uno a uno y se apoyan en ellas.'},
    {inicio:INICIO_PARKING, punto:INICIO_PARKING+.052, nombre:'La pérgola solar', titulo:['Pérgola solar','para empresas.'], subrayado:'Pérgola solar', texto:'Montamos los pilares entre las plazas de aparcamiento. Las vigas que los unen sostendrán las placas.'},
    {inicio:.953+DURACION_PARKING, punto:.963+DURACION_PARKING, nombre:'Los muelles de carga', titulo:['El turno','ya ha empezado.'], texto:'Un camión entra al muelle. Al diseñar la instalación, estudiamos a qué horas funcionan las máquinas y qué potencia necesitan.'}
  ];
  const viaje = $('#experiencia');
  const ventana = $('#viaje-ventana');
  const superficie = $('#viaje-3d');
  const imagenEtapa = $('#viaje-foto img');
  const imagenMovil = $('#viaje-foto source');
  const botonesEtapa = $$('.capitulos button');
  const botonAvance = $('#siguiente-etapa');
  const botonGiro = $('#abrir-visor');
  const horaVilla = $('#hora-villa');
  const periodoVilla = $('#periodo-villa');
  const iconoHora = $('#icono-hora');
  let minutoMostrado = -1;
  let faseActual = -1;
  let ultimoFotograma = '';
  let progresoActual = 0;
  let modeloMontaje;
  let preparando = false;
  let generacion = 0;
  let falloGrafico = false;
  let frameScroll = 0;
  let longitud = 1;
  const recorridoExtraNave=.20;
  const tramoCubierta=INICIO_PARKING-FIN_LLEGADA;
  const desplazamientoPara=p=>inicio+longitud*(p+recorridoExtraNave*faseCubierta(p));
  let inicio = 0;
  const cabeceras = raiz.host ? [...document.querySelectorAll('.site-header, .call-bar')] : [];

  function medirRecorrido() {
    const altoCabecera = cabeceras.reduce((total, elemento) => total + elemento.getBoundingClientRect().height, 0);
    if (raiz.host) raiz.host.style.setProperty('--franja', altoCabecera + 'px');
    inicio = viaje.getBoundingClientRect().top + scrollY - altoCabecera;
    // Reserva un breve tramo de lectura para la vivienda ya terminada.
    longitud = Math.max(1, (viaje.offsetHeight - ventana.offsetHeight) * .96 / (FIN_RECORRIDO+recorridoExtraNave));
    solicitarFrame();
  }

  function dibujarRecorrido() {
    frameScroll = 0;
    const distancia=(scrollY-inicio)/longitud;
    const extra=recorridoExtraNave*limite((distancia-FIN_LLEGADA)/(tramoCubierta+recorridoExtraNave));
    const valor=Math.max(0,Math.min(FIN_RECORRIDO,distancia-extra));
    if (valor === progresoActual && faseActual >= 0) return;
    progresoActual = valor;
    modeloMontaje?.progreso(valor);
    const empresa = valor >= etapas[8].inicio;
    const minuto = empresa ? -2 : Math.round((8 * 60 + tiempoVilla(progresoResidencial(valor)) * 870) / 5) * 5;
    if (minuto !== minutoMostrado) {
      minutoMostrado = minuto;
      ventana.classList.toggle('en-empresa',empresa);
      if (empresa) {
        periodoVilla.textContent = 'Autoconsumo industrial';
        iconoHora.setAttribute('href','#i-nave');
      } else {
        horaVilla.textContent = String(Math.floor(minuto / 60)).padStart(2, '0') + ':' + String(minuto % 60).padStart(2, '0');
        horaVilla.dateTime = horaVilla.textContent;
        periodoVilla.textContent = minuto < 720 ? 'Por la mañana' : minuto < 870 ? 'Mediodía' : minuto < 1125 ? 'Por la tarde' : minuto < 1230 ? 'Atardecer' : 'De noche';
        iconoHora.setAttribute('href', minuto >= 1230 ? '#i-moon' : '#i-sun');
      }
    }
    const nueva = etapas.findLastIndex(etapa => valor >= etapa.inicio);
    for (let i = 0; i < etapas.length; i++) {
      const fin = etapas[i + 1]?.inicio ?? FIN_RECORRIDO;
      const parte = limite((valor - etapas[i].inicio) / (fin - etapas[i].inicio));
      botonesEtapa[i].style.setProperty('--avance', String(i === nueva ? Math.max(.08, parte) : parte));
    }
    const parking = tiempoParking(valor);
    const cubierta=faseCubierta(valor);
    const texto = nueva===8 && cubierta>=INICIO_PLACAS_NAVE
      ? 'Las placas bajan por filas y se fijan sobre dos carriles. Entre bloques queda un pasillo para el mantenimiento.'
      : nueva !== 9 || parking < .46 ? etapas[nueva].texto
      : parking < .78 ? 'Las placas forman el techo de la pérgola. Dan sombra a los coches y producen electricidad para la nave.'
      : 'Con el cargador junto a la plaza, el coche puede aprovechar la energía solar mientras está aparcado.';
    const fotograma = nueva === 10 ? (valor < .965+DURACION_PARKING ? 'modelo/muelle-entrada' : 'modelo/etapa-10')
      : nueva === 9 ? (valor > .925+DURACION_PARKING ? 'modelo/descenso-muelle'
        : 'modelo/parking-' + (tiempoParking(valor)<.4?'estructura':tiempoParking(valor)<.78?'placas':'recarga'))
      : valor >= .833 && valor < .858 ? 'modelo/llegada-nave'
      : nueva === 8 && cubierta < .25 ? 'modelo/nave-inicio'
      : nueva === 8 && cubierta < .43 ? 'modelo/nave-carriles'
      : nueva === 8 && cubierta < INICIO_PLACAS_NAVE ? 'modelo/nave-carriles-fijados'
      : nueva === 8 && cubierta < .74 ? 'modelo/nave-paneles'
      : nueva === 8 && cubierta < .94 ? 'modelo/nave-apertura'
      : nueva === 7 && valor >= .812 ? 'modelo/salida-villa'
      : nueva === 7 && valor < .749 ? 'modelo/costa-giro' : 'modelo/etapa-' + (nueva + 1);
    if (fotograma !== ultimoFotograma) {
      ultimoFotograma = fotograma;
      imagenMovil.srcset = recurso(fotograma + '-movil.webp');
      imagenEtapa.src = recurso(fotograma + '.webp');
      imagenEtapa.alt = etapas[nueva].titulo.join(' ') + ' ' + texto;
    }
    const descripcion = $('#fase-texto');
    if (descripcion.textContent !== texto) descripcion.textContent = texto;
    if (nueva === faseActual) return;
    faseActual = nueva;
    const accesos = $('#accesos-inicio');
    if (accesos) accesos.hidden = nueva !== 0;
    const etapa = etapas[nueva];
    const titulo = $('#fase-titulo');
    titulo.replaceChildren();
    etapa.titulo.forEach((linea, indice) => {
      if (indice) titulo.append(document.createElement('br'), ' ');
      const pos = etapa.subrayado ? linea.indexOf(etapa.subrayado) : -1;
      if (pos < 0) { titulo.append(linea); return; }
      const acento = document.createElement('span');
      acento.className = 'trazo-marca';
      acento.textContent = etapa.subrayado;
      titulo.append(linea.slice(0, pos), acento, linea.slice(pos + etapa.subrayado.length));
    });
    $('#viaje-posicion').textContent = String(nueva + 1).padStart(2,'0') + ' / ' + etapas.length;
    $('#viaje-nombre').textContent = etapa.nombre;
    botonesEtapa.forEach((boton, i) => {
      if (i === nueva) boton.setAttribute('aria-current','step');
      else boton.removeAttribute('aria-current');
    });
    botonGiro.hidden = nueva !== 6;
    $('span', botonAvance).textContent = ({0:'Empezar el montaje',6:'Volar hacia el mar',7:'Ir a la nave',8:'Ver la pérgola',9:'Bajar a los muelles',10:'Ver soluciones'})[nueva] ?? 'Siguiente fase';
  }
  function solicitarFrame() {
    if (!frameScroll) frameScroll = requestAnimationFrame(dibujarRecorrido);
  }
  function irAEtapa(i) {
    if (i === etapas.length) {
      (document.getElementById('servicios') || $('#soluciones')).scrollIntoView({behavior:reducido.matches ? 'instant' : 'smooth'});
      return;
    }
    scrollTo({top:Math.ceil(desplazamientoPara(etapas[i].punto)), behavior:reducido.matches ? 'instant' : 'smooth'});
  }
  function abrirPlanoDesdeEnlace() {
    const punto={'#nave':etapas[8].punto,'#muelles':etapas[10].punto,'#pergola':etapas[9].punto,'#recarga':etapas[5].punto,'#parking-recarga':INICIO_PARKING+DURACION_PARKING}[location.hash];
    if (punto === undefined) return;
    medirRecorrido();
    scrollTo({top:Math.ceil(desplazamientoPara(punto)), behavior:'instant'});
  }
  window.addEventListener('load',abrirPlanoDesdeEnlace,{once:true, signal});
  window.addEventListener('hashchange',abrirPlanoDesdeEnlace,{signal});
  if(document.readyState==='complete')requestAnimationFrame(()=>{if(!signal.aborted)abrirPlanoDesdeEnlace();});
  botonesEtapa.forEach((boton, indice) => boton.addEventListener('click', () => irAEtapa(indice)));
  botonAvance.addEventListener('click', () => irAEtapa(faseActual + 1));

  async function prepararMontaje() {
    if (signal.aborted || preparando || modeloMontaje || reducido.matches || falloGrafico) return;
    const turno = ++generacion;
    preparando = true;
    try {
      const {montarVisor} = await cargarModulo();
      if (turno !== generacion || reducido.matches) return;
      modeloMontaje = montarVisor(superficie, {
        guiado:true,
        onListo:() => {
          if (turno === generacion && !falloGrafico) ventana.classList.add('modelo-visible');
        },
        onError:() => {
          falloGrafico = true;
          ventana.classList.remove('modelo-visible');
        }
      });
      modeloMontaje.progreso(progresoActual);
    } catch {
      falloGrafico = true;
      ventana.classList.remove('modelo-visible');
    } finally {
      preparando = false;
      if (turno !== generacion && !reducido.matches) prepararMontaje();
    }
  }
  reducido.addEventListener('change', () => {
    ++generacion;
    if (reducido.matches) {
      ventana.classList.remove('modelo-visible');
      modeloMontaje?.destruir();
      modeloMontaje = null;
    } else prepararMontaje();
  },{signal});
  window.addEventListener('scroll', solicitarFrame, {passive:true, signal});
  const observador = new ResizeObserver(medirRecorrido);
  observador.observe(viaje);
  cabeceras.forEach(elemento => observador.observe(elemento));
  window.addEventListener('resize', medirRecorrido,{signal});
  window.addEventListener('pageshow', medirRecorrido,{signal});
  medirRecorrido();
  dibujarRecorrido();
  prepararMontaje();

  const visor = $('#visor');
  const luz = $('#cambiar-luz');
  let modeloLibre;
  let intento = 0;
  let dia = false;
  function mostrarVista(nombre) {
    $$('.vistas button').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.vista === nombre)));
    $('#libre-poster').src = recurso(vistas[nombre].imagen);
    $('#libre-poster').alt = 'Vista ilustrativa. ' + vistas[nombre].detalle;
    $('#detalle-vista').textContent = vistas[nombre].detalle;
  }
  function fotos() {
    $('#libre-canvas').hidden = true;
    luz.hidden = true;
    $('#consejo-visor').textContent = 'Vista en imágenes. Elige un detalle para acercarte.';
  }
  async function explorar(vista) {
    const solicitud = ++intento;
    visor.showModal();
    mostrarVista(vista);
    $('#libre-canvas').hidden = false;
    luz.hidden = true;
    $('#consejo-visor').textContent = 'Preparando la vivienda en 3D…';
    try {
      const {montarVisor} = await cargarModulo();
      if (signal.aborted || !visor.open || solicitud !== intento) return;
      let fallo = false;
      modeloLibre = montarVisor($('#libre-canvas'), {onError:() => { fallo = true; fotos(); }});
      if (fallo) return;
      modeloLibre.progreso(1);
      modeloLibre.vista(vista);
      dia = false;
      luz.setAttribute('aria-pressed','false');
      $('span', luz).textContent = 'Ver de día';
      luz.hidden = typeof modeloLibre.luz !== 'function';
      $('#consejo-visor').textContent = 'Arrastra para girar. Pellizca o usa la rueda para acercarte.';
    } catch {
      if (visor.open && solicitud === intento) fotos();
    }
  }
  $('#abrir-visor').addEventListener('click', () => explorar('cubierta'));
  $$('.vistas button').forEach(el => el.addEventListener('click', () => {
    mostrarVista(el.dataset.vista);
    modeloLibre?.vista(el.dataset.vista);
  }));
  luz.addEventListener('click', () => {
    dia = !dia;
    modeloLibre?.luz?.(dia ? 'dia' : 'noche');
    luz.setAttribute('aria-pressed',String(dia));
    $('span', luz).textContent = dia ? 'Ver de noche' : 'Ver de día';
  });
  visor.addEventListener('close', () => {
    ++intento;
    modeloLibre?.destruir();
    modeloLibre = null;
  });
  const pelicula = $('#pelicula');
  const reproductor = $('#reproductor');
  $$('[data-obra]').forEach(el => el.addEventListener('click', () => {
    const nombre = el.dataset.obra;
    $('#titulo-pelicula').textContent = peliculaInfo[nombre][0];
    $('#pie-video').textContent = peliculaInfo[nombre][1];
    reproductor.poster = 'assets/obra-' + nombre + '.webp';
    reproductor.src = 'assets/obra-' + nombre + '.mp4';
    pelicula.showModal();
    reproductor.play().catch(() => {});
  }));
  pelicula?.addEventListener('close', () => {
    reproductor.pause(); reproductor.removeAttribute('src'); reproductor.load();
  });
  $$('dialog').forEach(dialogo => {
    $('.cerrar', dialogo).addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('click', evento => { if (evento.target === dialogo) dialogo.close(); });
  });
  return () => {
    controlador.abort();
    ++generacion;
    ++intento;
    observador.disconnect();
    cancelAnimationFrame(frameScroll);
    modeloMontaje?.destruir();
    modeloLibre?.destruir();
  };
}
