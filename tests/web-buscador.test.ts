/** Search box of the header and glossary. Every person is fictitious. */
import { describe, expect, it } from 'vitest';

import { glosario } from '../config/glosario.ts';
import { buscar, indiceBuscador, type EntradaBuscador } from '../web/src/lib/buscador.ts';
import type { FilaRanking, Ranking } from '../web/src/lib/data.ts';

function fila(periodo: string, slug: string, nombre: string, grupo: string, circunscripcion: string): FilaRanking {
  return {
    periodo,
    slug,
    nombre,
    grupo,
    partido: 'PX',
    circunscripcion,
    roles: [],
    situacion: 'ranking',
    indice: 50,
    cobertura: 0.8,
    posicion: 1,
    dimensiones: {},
  };
}

const ranking = {
  filas: [
    fila('legislatura', 'blas-ficticio', 'Ficticio Álvarez, Blas', 'GZ', 'Sur'),
    fila('legislatura', 'ana-ficticia', 'Ficticia Núñez, Ana', 'GA', 'Norte'),
    fila('12m', 'ana-ficticia', 'Ficticia Núñez, Ana', 'GZ', 'Norte'),
    fila('12m', 'eva-ficticia', 'Ficticia Bravo, Eva', 'G?', 'Este'),
  ],
} as unknown as Ranking;

describe('index of the header search', () => {
  const indice = indiceBuscador(ranking, { GA: 'Alfa', GZ: 'Zeta' });

  it('lists every deputy once, in alphabetical order', () => {
    expect(indice.map((entrada) => entrada[0])).toEqual(['eva-ficticia', 'ana-ficticia', 'blas-ficticio']);
  });

  it('takes the group of the first period that lists the deputy, by its short name', () => {
    expect(indice.find((entrada) => entrada[0] === 'ana-ficticia')).toEqual([
      'ana-ficticia',
      'Ficticia Núñez, Ana',
      'Alfa',
      'Norte',
    ]);
    // A group without a short name keeps its code.
    expect(indice.find((entrada) => entrada[0] === 'eva-ficticia')?.[2]).toBe('G?');
  });
});

describe('search', () => {
  const indice: EntradaBuscador[] = [
    ['a', 'Ficticia Bravo, Eva', 'Alfa', 'Este'],
    ['b', 'Ficticia Núñez, Ana', 'Alfa', 'Norte'],
    ['c', 'Ficticio Álvarez, Blas', 'Zeta', 'Sur'],
  ];

  it('matches every word typed, in any order and without accents', () => {
    expect(buscar(indice, 'nunez', 6).map((entrada) => entrada[0])).toEqual(['b']);
    expect(buscar(indice, 'ana ficticia', 6).map((entrada) => entrada[0])).toEqual(['b']);
    expect(buscar(indice, 'ALVAREZ', 6).map((entrada) => entrada[0])).toEqual(['c']);
    expect(buscar(indice, 'fictici', 6)).toHaveLength(3);
  });

  it('searches names only, not groups or constituencies', () => {
    expect(buscar(indice, 'alfa', 6)).toEqual([]);
    expect(buscar(indice, 'norte', 6)).toEqual([]);
  });

  it('stops at the limit and returns nothing for an empty query', () => {
    expect(buscar(indice, 'fictici', 2).map((entrada) => entrada[0])).toEqual(['a', 'b']);
    expect(buscar(indice, '  ', 6)).toEqual([]);
    expect(buscar(indice, 'zzz', 6)).toEqual([]);
  });
});

describe('glossary', () => {
  it('has one short entry per term, with a unique id', () => {
    expect(new Set(glosario.map((glosa) => glosa.id)).size).toBe(glosario.length);
    for (const glosa of glosario) {
      expect(glosa.id).toMatch(/^[a-z-]+$/);
      expect(glosa.texto.length).toBeLessThan(200);
      expect(glosa.texto.endsWith('.')).toBe(true);
    }
  });

  it('explains the two terms the pages link to', () => {
    expect(glosario.map((glosa) => glosa.id)).toEqual(expect.arrayContaining(['percentil', 'cobertura']));
  });
});
