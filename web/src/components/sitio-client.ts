/**
 * Script of every page, without a framework (decision D-038):
 *
 *   - the search box of the header, which replaces the link to the complete list and
 *     fetches its index of deputies the first time it is used;
 *   - folded sections: a link to something inside one opens it.
 *
 * Without it, the header keeps the link to the list and the sections open by hand.
 */
import { buscar, type EntradaBuscador } from '../lib/buscador.ts';

const SUGERENCIAS = 6;

function crear<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  atributos: Readonly<Record<string, string>> = {},
  texto?: string,
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) elemento.setAttribute(nombre, valor);
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function buscador(): void {
  const hueco = document.querySelector<HTMLElement>('[data-buscador]');
  if (!hueco) return;
  let indice: EntradaBuscador[] | undefined;
  let pedido: Promise<void> | undefined;

  const campo = crear('input', {
    id: 'buscador-q',
    type: 'search',
    placeholder: 'Buscar diputado',
    autocomplete: 'off',
    spellcheck: 'false',
    maxlength: '80',
  });
  const etiqueta = crear('label', { class: 'sr', for: 'buscador-q' }, 'Buscar diputado');
  const lista = crear('ul', { id: 'buscador-lista', class: 'sugerencias tarjeta', 'aria-label': 'Diputados' });
  lista.hidden = true;
  hueco.replaceChildren(etiqueta, campo, lista);
  hueco.classList.add('activo');

  const cerrar = (): void => {
    lista.hidden = true;
  };
  const pintar = (): void => {
    const q = campo.value;
    if (!q.trim() || !indice) return cerrar();
    const encontrados = buscar(indice, q, SUGERENCIAS);
    lista.replaceChildren(
      ...(encontrados.length === 0
        ? [crear('li', { class: 'vacio' }, 'Ningún diputado coincide.')]
        : encontrados.map(([slug, nombre, grupo, circunscripcion]) => {
            const enlace = crear('a', { href: `/diputados/${slug}` });
            enlace.append(
              crear('span', { class: 'nombre' }, nombre),
              crear('span', { class: 'meta' }, `${grupo} · ${circunscripcion}`),
            );
            const item = crear('li');
            item.append(enlace);
            return item;
          })),
    );
    lista.hidden = false;
  };
  const cargar = (): Promise<void> => {
    pedido ??= fetch('/buscador.json')
      .then((respuesta) => (respuesta.ok ? (respuesta.json() as Promise<EntradaBuscador[]>) : []))
      .then((datos) => {
        indice = datos;
      })
      .catch(() => {
        // Without the index the box does nothing; the list page is one tap away.
        indice = [];
      });
    return pedido;
  };

  campo.addEventListener('focus', () => void cargar().then(pintar));
  campo.addEventListener('input', () => void cargar().then(pintar));
  campo.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      campo.value = '';
      cerrar();
    } else if (event.key === 'Enter') {
      const primero = lista.querySelector<HTMLAnchorElement>('a');
      if (!lista.hidden && primero) window.location.assign(primero.href);
    } else if (event.key === 'ArrowDown') {
      const primero = lista.querySelector<HTMLAnchorElement>('a');
      if (!lista.hidden && primero) {
        event.preventDefault();
        primero.focus();
      }
    }
  });
  lista.addEventListener('keydown', (event) => {
    const enlaces = [...lista.querySelectorAll<HTMLAnchorElement>('a')];
    const actual = enlaces.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const destino = actual + (event.key === 'ArrowDown' ? 1 : -1);
      (destino < 0 ? campo : (enlaces[Math.min(destino, enlaces.length - 1)] ?? campo)).focus();
    } else if (event.key === 'Escape') {
      cerrar();
      campo.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (event.target instanceof Node && !hueco.contains(event.target)) cerrar();
  });
}

/** A link to a folded section, or to something inside one, opens it. */
function abrirDestino(): void {
  const id = decodeURIComponent(window.location.hash.slice(1));
  if (!id) return;
  const destino = document.getElementById(id);
  const plegado = destino?.closest('details');
  if (!destino || !plegado || plegado.open) return;
  plegado.open = true;
  destino.scrollIntoView();
}

export function boot(): void {
  buscador();
  abrirDestino();
  window.addEventListener('hashchange', abrirDestino);
}
