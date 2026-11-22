import {iniciarPortada} from './montaje.js?v=fafacc8c4dac';

class PortadaAureqis extends HTMLElement {
  connectedCallback() {
    const plantilla = this.querySelector('template');
    if (!plantilla || this.cerrar) return;
    const raiz = this.shadowRoot ?? this.attachShadow({mode: 'open'});
    raiz.replaceChildren(plantilla.content.cloneNode(true));
    this.cerrar = iniciarPortada(raiz);
    this.observador = new IntersectionObserver(([entrada]) => {
      this.toggleAttribute('data-visible', entrada.isIntersecting);
    });
    this.observador.observe(this);
  }

  disconnectedCallback() {
    this.observador?.disconnect();
    this.cerrar?.();
    this.cerrar = undefined;
  }
}

if (!customElements.get('aureqis-portada')) {
  customElements.define('aureqis-portada', PortadaAureqis);
}
