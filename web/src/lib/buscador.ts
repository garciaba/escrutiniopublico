/** Search box of the header: its index of deputies and how a query is matched. Pure functions. */
import type { Ranking } from './data.ts';
import { sinAcentos } from './format.ts';

/** [slug, name, short name of the group, constituency] */
export type EntradaBuscador = readonly [string, string, string, string];

/** Every deputy once, in alphabetical order, with the group of the first period that lists them. */
export function indiceBuscador(ranking: Ranking, nombresCortos: Readonly<Record<string, string>>): EntradaBuscador[] {
  const vistos = new Map<string, EntradaBuscador>();
  for (const fila of ranking.filas) {
    if (vistos.has(fila.slug)) continue;
    vistos.set(fila.slug, [fila.slug, fila.nombre, nombresCortos[fila.grupo] ?? fila.grupo, fila.circunscripcion]);
  }
  return [...vistos.values()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
}

/** Deputies whose name contains every word typed, in any order and without accents. */
export function buscar(indice: readonly EntradaBuscador[], q: string, limite: number): EntradaBuscador[] {
  const palabras = sinAcentos(q)
    .split(/[\s,]+/)
    .filter(Boolean);
  if (palabras.length === 0) return [];
  const encontrados: EntradaBuscador[] = [];
  for (const entrada of indice) {
    const nombre = sinAcentos(entrada[1]);
    if (palabras.every((palabra) => nombre.includes(palabra))) encontrados.push(entrada);
    if (encontrados.length === limite) break;
  }
  return encontrados;
}
