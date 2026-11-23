/** Texts and scales of the /grupos page. Pure functions, covered by tests. */
import type { Agregado } from './data.ts';
import { num, plural, porcentaje } from './format.ts';

/** Value of an aggregated metric as printed: "99,3 %", "17,6" or "0,66". */
export function valorAgregado(valor: number, unidad: string): string {
  if (unidad === 'proporcion') return porcentaje(valor, 1);
  return num(valor, Math.abs(valor) >= 10 ? 1 : 2);
}

/** What the figure of a metric means for a group, in a few words. */
export function unidadAgregada(unidad: string): string {
  return unidad === 'proporcion'
    ? 'Votos emitidos, de las votaciones en cuya lista figuran'
    : 'Por diputado, cada 100 días en activo';
}

/**
 * Top of the scale of the bars of one metric: 1 for proportions, otherwise the highest
 * value among the groups and the Chamber, so the longest bar fills the track.
 */
export function escala(valores: readonly (number | null | undefined)[], unidad: string): number {
  if (unidad === 'proporcion') return 1;
  return Math.max(0, ...valores.map((valor) => valor ?? 0));
}

/** Width of a bar, 0 to 100. A real value never disappears: at least a sliver is drawn. */
export function anchoBarra(valor: number, max: number): number {
  if (max <= 0 || valor <= 0) return 0;
  return Math.max(1, Math.min(100, (100 * valor) / max));
}

/** "150 diputados", "1 diputado". */
export function nDiputados(n: number): string {
  return `${num(n)} ${plural(n, 'diputado', 'diputados')}`;
}

/** Who is left out of the figures of an aggregate, or '' when nobody is. */
export function fueraDelCalculo(agregado: Pick<Agregado, 'gobierno' | 'periodo_insuficiente'>): string {
  const partes: string[] = [];
  if (agregado.gobierno > 0) {
    partes.push(`${num(agregado.gobierno)} ${plural(agregado.gobierno, 'miembro', 'miembros')} del Gobierno`);
  }
  if (agregado.periodo_insuficiente > 0) {
    partes.push(`${num(agregado.periodo_insuficiente)} con periodo insuficiente`);
  }
  return partes.join(' y ');
}

/** Text alternative of the strip of one group. */
export function resumenDistribucion(agregado: Agregado, minimoBanda: number): string {
  const { indice, diputados, nombre_corto: nombre } = agregado;
  if (!indice || diputados === 0) return `${nombre}: ningún diputado con índice en el periodo.`;
  if (diputados === 1) return `${nombre}: un diputado, con índice ${num(indice.mediana, 1)}.`;
  const rango = `de ${num(indice.min, 1)} a ${num(indice.max, 1)}`;
  const centro =
    diputados >= minimoBanda ? `; la mitad central, entre ${num(indice.p25, 1)} y ${num(indice.p75, 1)}` : '';
  return `${nombre}: índice de sus ${nDiputados(diputados)}, ${rango}; mediana ${num(indice.mediana, 1)}${centro}.`;
}
