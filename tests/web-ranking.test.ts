/** Ranking table logic: compact data, URL state, filters and sorting. Every person is fictitious. */
import { describe, expect, it } from 'vitest';

import type { FilaRanking, Ranking } from '../web/src/lib/data.ts';
import {
  aplicar,
  compactar,
  direccionPorDefecto,
  enumerar,
  escribirEstado,
  estadoInicial,
  filasDe,
  leerEstado,
  opciones,
} from '../web/src/lib/ranking.ts';

function fila(
  periodo: string,
  slug: string,
  nombre: string,
  grupo: string,
  partido: string,
  circunscripcion: string,
  indice: number | null,
  posicion: number | null,
  dims: [number | null, number | null],
  situacion: FilaRanking['situacion'] = 'ranking',
  roles: string[] = [],
): FilaRanking {
  return {
    periodo,
    slug,
    nombre,
    grupo,
    partido,
    circunscripcion,
    roles,
    situacion,
    indice,
    cobertura: indice === null ? null : 0.5,
    posicion,
    dimensiones: { uno: dims[0], dos: dims[1], tres: null },
  };
}

const ranking: Ranking = {
  metodologia_version: '0.0.0',
  fecha_calculo: '2024-12-31',
  legislatura: { numero: 99, nombre: 'XCIX', inicio: '2024-01-01', fin: null, finalizada: false },
  dimensiones: [
    { id: 'uno', nombre: 'Dimensión uno', peso: 1 },
    { id: 'dos', nombre: 'Dimensión dos', peso: 1 },
    { id: 'tres', nombre: 'Dimensión sin dato', peso: 1 },
  ],
  metricas: [],
  grupos: [
    { id: 'GZ', nombre: 'Grupo Zeta', nombre_corto: 'Zeta' },
    { id: 'GA', nombre: 'Grupo Alfa', nombre_corto: 'Alfa' },
  ],
  periodos: [
    {
      id: 'legislatura',
      nombre: 'Legislatura',
      estado: 'disponible',
      motivo: null,
      desde: '2024-01-01',
      hasta: '2024-12-31',
      dias_minimos: 90,
      poblacion_referencia: 3,
      total_ranking: 3,
      cobertura: 0.5,
      metricas_disponibles: [],
    },
    {
      id: '12m',
      nombre: 'Último año',
      estado: 'disponible',
      motivo: null,
      desde: '2024-01-01',
      hasta: '2024-12-31',
      dias_minimos: 90,
      poblacion_referencia: 1,
      total_ranking: 1,
      cobertura: 0.5,
      metricas_disponibles: [],
    },
    {
      id: '1m',
      nombre: 'Último mes',
      estado: 'no_disponible',
      motivo: 'sin_actividad_en_el_periodo',
      desde: null,
      hasta: null,
      dias_minimos: 15,
      poblacion_referencia: 0,
      total_ranking: 0,
      cobertura: 0,
      metricas_disponibles: [],
    },
  ],
  filas: [
    fila('legislatura', 'ana-ficticia', 'Ficticia Núñez, Ana', 'GA', 'PA', 'Norte', 80, 1, [90, 70]),
    fila('legislatura', 'blas-ficticio', 'Ficticio Álvarez, Blas', 'GZ', 'PZ', 'Sur', 60, 2, [40, 80], 'ranking', [
      'mesa',
    ]),
    fila('legislatura', 'carla-ficticia', 'Ficticia Ortiz, Carla', 'GZ', 'PB', 'Norte', 60, 2, [60, 60]),
    fila('legislatura', 'dario-ficticio', 'Ficticio Zamora, Darío', 'GA', 'PA', 'Sur', 10, null, [5, 15], 'gobierno', [
      'gobierno',
    ]),
    fila(
      'legislatura',
      'eva-ficticia',
      'Ficticia Bravo, Eva',
      'GA',
      'PA',
      'Este',
      null,
      null,
      [null, null],
      'periodo_insuficiente',
    ),
    fila('12m', 'ana-ficticia', 'Ficticia Núñez, Ana', 'GZ', 'PA', 'Norte', 50, 1, [50, 50]),
  ],
};

const data = compactar(ranking, { colores: { GA: '#111111' }, nombresCortos: { uno: 'Uno' } });
const inicial = estadoInicial(data);
const slugs = (estado = inicial) => aplicar(filasDe(data, estado.periodo), estado, data).map((f) => f.slug);

describe('compactar and filasDe', () => {
  it('keeps only the dimensions with data and their short names', () => {
    expect(data.dimensiones).toEqual([
      { id: 'uno', nombre: 'Dimensión uno', corto: 'Uno' },
      { id: 'dos', nombre: 'Dimensión dos', corto: 'Dimensión dos' },
    ]);
  });

  it('stores each deputy once and gives every group a colour', () => {
    expect(data.diputados).toHaveLength(5);
    expect(data.grupos).toEqual([
      { id: 'GZ', nombre: 'Zeta', color: '#9c9c9c' },
      { id: 'GA', nombre: 'Alfa', color: '#111111' },
    ]);
  });

  it('rebuilds the rows of a period, with the group the deputy had in that period', () => {
    const filas = filasDe(data, 'legislatura');
    expect(filas).toHaveLength(5);
    expect(filas[1]).toEqual({
      slug: 'blas-ficticio',
      nombre: 'Ficticio Álvarez, Blas',
      partido: 'PZ',
      circunscripcion: 'Sur',
      grupo: 'GZ',
      roles: ['mesa'],
      situacion: 'ranking',
      indice: 60,
      posicion: 2,
      dims: [40, 80],
    });
    expect(filasDe(data, '12m')[0]?.grupo).toBe('GZ');
    expect(filasDe(data, 'no-existe')).toEqual([]);
  });

  it('survives a round trip through JSON, as it travels inside the page', () => {
    expect(filasDe(JSON.parse(JSON.stringify(data)), 'legislatura')).toEqual(filasDe(data, 'legislatura'));
  });
});

describe('default view', () => {
  it('opens on the first available period, by position, without Government members', () => {
    expect(inicial).toMatchObject({ periodo: 'legislatura', orden: 'posicion', dir: 'asc', gobierno: false });
    // Tied positions are ordered by name: "Ficticia Ortiz" comes before "Ficticio Álvarez".
    expect(slugs()).toEqual(['ana-ficticia', 'carla-ficticia', 'blas-ficticio', 'eva-ficticia']);
  });

  it('lists the options of the drop-downs in alphabetical order', () => {
    expect(opciones(data)).toEqual({
      grupos: [
        { id: 'GA', nombre: 'Alfa' },
        { id: 'GZ', nombre: 'Zeta' },
      ],
      partidos: ['PA', 'PB', 'PZ'],
      circunscripciones: ['Este', 'Norte', 'Sur'],
    });
  });
});

describe('filters', () => {
  it('filters by group, party and constituency without changing the general position', () => {
    const filas = aplicar(filasDe(data, 'legislatura'), { ...inicial, grupo: 'GZ' }, data);
    expect(filas.map((f) => [f.slug, f.posicion])).toEqual([
      ['carla-ficticia', 2],
      ['blas-ficticio', 2],
    ]);
    expect(slugs({ ...inicial, partido: 'PB' })).toEqual(['carla-ficticia']);
    expect(slugs({ ...inicial, circunscripcion: 'Norte' })).toEqual(['ana-ficticia', 'carla-ficticia']);
  });

  it('searches names without accents, in any word order', () => {
    expect(slugs({ ...inicial, q: 'nunez' })).toEqual(['ana-ficticia']);
    expect(slugs({ ...inicial, q: 'Blas  ALVAREZ' })).toEqual(['blas-ficticio']);
    expect(slugs({ ...inicial, q: 'ficticia, carla' })).toEqual(['carla-ficticia']);
    expect(slugs({ ...inicial, q: 'nadie' })).toEqual([]);
  });

  it('includes Government members only on request, without position', () => {
    const conGobierno = aplicar(filasDe(data, 'legislatura'), { ...inicial, gobierno: true }, data);
    expect(conGobierno.slice(-2).map((f) => [f.slug, f.posicion])).toEqual([
      ['eva-ficticia', null],
      ['dario-ficticio', null],
    ]);
  });
});

describe('sorting', () => {
  it('sorts by name in both directions', () => {
    expect(slugs({ ...inicial, orden: 'nombre', dir: 'asc' })).toEqual([
      'eva-ficticia',
      'ana-ficticia',
      'carla-ficticia',
      'blas-ficticio',
    ]);
    expect(slugs({ ...inicial, orden: 'nombre', dir: 'desc' })[0]).toBe('blas-ficticio');
  });

  it('sorts by index or by a dimension, breaking ties by name', () => {
    expect(slugs({ ...inicial, orden: 'indice', dir: 'desc' })).toEqual([
      'ana-ficticia',
      'carla-ficticia',
      'blas-ficticio',
      'eva-ficticia',
    ]);
    expect(slugs({ ...inicial, orden: 'dos', dir: 'desc' })).toEqual([
      'blas-ficticio',
      'ana-ficticia',
      'carla-ficticia',
      'eva-ficticia',
    ]);
  });

  it('keeps rows without a value last in both directions: not available is not zero', () => {
    expect(slugs({ ...inicial, orden: 'indice', dir: 'asc' }).at(-1)).toBe('eva-ficticia');
    expect(slugs({ ...inicial, orden: 'uno', dir: 'asc', gobierno: true })).toEqual([
      'dario-ficticio',
      'blas-ficticio',
      'carla-ficticia',
      'ana-ficticia',
      'eva-ficticia',
    ]);
  });

  it('has a natural direction for each column', () => {
    expect(direccionPorDefecto('posicion')).toBe('asc');
    expect(direccionPorDefecto('nombre')).toBe('asc');
    expect(direccionPorDefecto('indice')).toBe('desc');
  });
});

describe('state in the URL', () => {
  it('writes nothing for the default view', () => {
    expect(escribirEstado(inicial, data)).toBe('');
  });

  it('round-trips every filter', () => {
    const estado = {
      periodo: '12m',
      q: 'ana',
      grupo: 'GZ',
      partido: 'PA',
      circunscripcion: 'Norte',
      orden: 'dos',
      dir: 'asc' as const,
      gobierno: true,
    };
    const query = escribirEstado(estado, data);
    expect(query).toBe('?periodo=12m&q=ana&grupo=GZ&candidatura=PA&circunscripcion=Norte&orden=dos&dir=asc&gobierno=1');
    expect(leerEstado(query, data)).toEqual(estado);
  });

  it('leaves the direction out when it is the natural one of the column', () => {
    expect(escribirEstado({ ...inicial, orden: 'indice', dir: 'desc' }, data)).toBe('?orden=indice');
    expect(leerEstado('?orden=indice', data)).toMatchObject({ orden: 'indice', dir: 'desc' });
  });

  it('still reads the old name of the electoral list parameter', () => {
    expect(leerEstado('?partido=PB', data).partido).toBe('PB');
    expect(leerEstado('?candidatura=PA&partido=PB', data).partido).toBe('PA');
  });

  it('ignores unknown values and unavailable periods', () => {
    expect(leerEstado('?periodo=1m&grupo=XX&partido=??&circunscripcion=Marte&orden=tres&dir=arriba', data)).toEqual(
      inicial,
    );
    expect(leerEstado('?periodo=nunca', data).periodo).toBe('legislatura');
  });

  it('limits the length of the search text', () => {
    expect(leerEstado(`?q=${'a'.repeat(200)}`, data).q).toHaveLength(80);
  });
});

describe('enumerar', () => {
  it('joins a list as a Spanish enumeration', () => {
    expect(enumerar([])).toBe('');
    expect(enumerar(['a'])).toBe('a');
    expect(enumerar(['a', 'b'])).toBe('a y b');
    expect(enumerar(['a', 'b', 'c'])).toBe('a, b y c');
  });
});
