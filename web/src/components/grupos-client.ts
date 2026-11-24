/**
 * Progressive enhancement of the groups page, without a framework: pointing at a strip,
 * or touching it, names the nearest deputy and links to the profile. Without this
 * script the ticks keep their tooltips and the figures are in the table below.
 */

const REPOSO = 'Toca una raya para ver al diputado.';

function lectura(figura: HTMLElement): void {
  const salida = figura.querySelector<HTMLElement>('.dist-lectura');
  if (!salida) return;
  const rayas = [...figura.querySelectorAll<SVGLineElement>('.raya[data-slug]')];
  if (rayas.length === 0) return;
  salida.textContent = REPOSO;
  let activa: SVGLineElement | undefined;

  const mostrar = (franja: SVGSVGElement, clientX: number): void => {
    const caja = franja.getBoundingClientRect();
    if (caja.width === 0) return;
    const posicion = ((clientX - caja.left) / caja.width) * 100;
    let cercana: SVGLineElement | undefined;
    let distancia = Number.POSITIVE_INFINITY;
    for (const raya of franja.querySelectorAll<SVGLineElement>('.raya[data-slug]')) {
      const separacion = Math.abs(Number.parseFloat(raya.getAttribute('x1') ?? '') - posicion);
      if (separacion < distancia) {
        distancia = separacion;
        cercana = raya;
      }
    }
    if (!cercana || cercana === activa) return;
    activa?.classList.remove('activa');
    activa = cercana;
    activa.classList.add('activa');
    // The tooltip of the tick already reads "Name: index".
    const [nombre = '', indice = ''] = (cercana.querySelector('title')?.textContent ?? '').split(': ');
    const enlace = document.createElement('a');
    enlace.href = `/diputados/${cercana.dataset.slug ?? ''}`;
    enlace.textContent = nombre;
    salida.replaceChildren(enlace, ` · ${indice}`);
  };

  for (const franja of figura.querySelectorAll<SVGSVGElement>('svg.dist-franja')) {
    if (!franja.querySelector('.raya[data-slug]')) continue;
    franja.addEventListener('pointermove', (event) => mostrar(franja, event.clientX));
    franja.addEventListener('pointerdown', (event) => mostrar(franja, event.clientX));
  }
}

export function boot(): void {
  document.querySelectorAll<HTMLElement>('figure.dist').forEach(lectura);
}
