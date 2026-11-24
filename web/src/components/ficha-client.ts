/**
 * Progressive enhancement of a profile, without a framework: the section links become
 * tabs and the monthly charts say which month is under the pointer. Without this
 * script the page is the same content, one section after another.
 */
import { descodificarSerie, lecturaMensual, mesSiguiente, type UnidadMensual } from '../lib/ficha.ts';

function pestanas(): void {
  const raiz = document.querySelector<HTMLElement>('.ficha');
  const lista = raiz?.querySelector<HTMLElement>('.pestanas ul');
  if (!raiz || !lista) return;
  const enlaces = [...lista.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const paneles = enlaces.map((enlace) => document.getElementById(enlace.hash.slice(1)));
  if (enlaces.length < 2 || paneles.some((panel) => panel === null)) return;

  lista.setAttribute('role', 'tablist');
  enlaces.forEach((enlace, i) => {
    const panel = paneles[i];
    enlace.parentElement?.setAttribute('role', 'presentation');
    enlace.setAttribute('role', 'tab');
    enlace.id = `pestana-${enlace.hash.slice(1)}`;
    enlace.setAttribute('aria-controls', panel?.id ?? '');
    panel?.setAttribute('role', 'tabpanel');
    panel?.removeAttribute('aria-label');
    panel?.setAttribute('aria-labelledby', enlace.id);
  });

  const elegir = (indice: number, foco = false): void => {
    enlaces.forEach((enlace, i) => {
      enlace.setAttribute('aria-selected', String(i === indice));
      enlace.tabIndex = i === indice ? 0 : -1;
      const panel = paneles[i];
      if (panel) panel.hidden = i !== indice;
    });
    if (foco) enlaces[indice]?.focus();
  };
  const desdeDireccion = (): number =>
    Math.max(
      0,
      enlaces.findIndex((enlace) => enlace.hash === window.location.hash),
    );
  const anotar = (indice: number): void => {
    // The first tab is the page itself: no fragment, so the address stays clean.
    const destino = indice === 0 ? window.location.pathname + window.location.search : (enlaces[indice]?.hash ?? '');
    window.history.replaceState(null, '', destino);
  };

  enlaces.forEach((enlace, i) => {
    enlace.addEventListener('click', (event) => {
      event.preventDefault();
      elegir(i);
      anotar(i);
    });
    enlace.addEventListener('keydown', (event) => {
      const ultimo = enlaces.length - 1;
      const destino =
        event.key === 'ArrowRight'
          ? i === ultimo
            ? 0
            : i + 1
          : event.key === 'ArrowLeft'
            ? i === 0
              ? ultimo
              : i - 1
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? ultimo
                : -1;
      if (destino === -1) return;
      event.preventDefault();
      elegir(destino, true);
      anotar(destino);
    });
  });
  window.addEventListener('hashchange', () => elegir(desdeDireccion()));
  raiz.classList.add('con-pestanas');
  elegir(desdeDireccion());
}

function graficas(): void {
  for (const figura of document.querySelectorAll<HTMLElement>('.evolucion')) {
    const svg = figura.querySelector<SVGSVGElement>('svg.chispa');
    const lectura = figura.querySelector<HTMLElement>('.chispa-lectura');
    if (!svg || !lectura) continue;
    const valores = descodificarSerie(svg.dataset.valores ?? '');
    const inicio = svg.dataset.inicio ?? '';
    if (valores.length === 0 || !inicio) continue;
    const config = {
      unidad: svg.dataset.unidad,
      objeto: [svg.dataset.uno ?? '', svg.dataset.varios ?? ''],
    } as UnidadMensual;
    const barras = [...svg.querySelectorAll<SVGRectElement>('rect')];
    const paso = svg.viewBox.baseVal.width / valores.length;
    const reposo = lectura.textContent ?? '';

    const mostrar = (clientX: number): void => {
      const caja = svg.getBoundingClientRect();
      if (caja.width === 0) return;
      const indice = Math.min(
        valores.length - 1,
        Math.max(0, Math.floor(((clientX - caja.left) / caja.width) * valores.length)),
      );
      lectura.textContent = lecturaMensual(mesSiguiente(inicio, indice), valores[indice] ?? null, config);
      for (const barra of barras) {
        barra.classList.toggle('activa', Math.floor(barra.x.baseVal.value / paso) === indice);
      }
    };
    const soltar = (): void => {
      lectura.textContent = reposo;
      for (const barra of barras) barra.classList.remove('activa');
    };
    svg.addEventListener('pointermove', (event) => mostrar(event.clientX));
    svg.addEventListener('pointerdown', (event) => mostrar(event.clientX));
    svg.addEventListener('pointerleave', (event) => {
      // A finger leaves the reading in place; a mouse that moves away clears it.
      if (event.pointerType === 'mouse') soltar();
    });
  }
}

export function boot(): void {
  pestanas();
  graficas();
}
