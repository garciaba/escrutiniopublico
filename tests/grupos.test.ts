/** Aggregates by group and by electoral list (decision D-037). Every person and figure is fictitious. */
import { describe, expect, it } from 'vitest';

import type { DeputyPeriod, MetricResult, PeriodResult } from '../pipeline/metrics/engine.ts';
import { buildGrupos, type GruposInput } from '../pipeline/metrics/grupos.ts';
import { quantile } from '../pipeline/metrics/stats.ts';

const scoring = {
  metodologiaVersion: '9.9.9',
  decimales: 1,
  coberturaMinima: 0.4,
  poblacionReferencia: { diasMinimos: 90, proporcionMinimaPeriodo: 0.5 },
  periodos: [],
  dimensiones: [
    { id: 'uno', nombre: 'Dimensión uno', peso: 50 },
    { id: 'dos', nombre: 'Dimensión dos', peso: 50 },
  ],
  metricas: [
    { id: 'votos', dimension: 'uno', estado: 'observado', nombre: 'Votos', unidad: 'proporcion' },
    { id: 'preguntas', dimension: 'dos', estado: 'calculado', nombre: 'Preguntas', unidad: 'por_100_dias' },
    { id: 'sin_fuente', dimension: 'dos', estado: 'no_disponible', nombre: 'Sin fuente', unidad: 'recuento' },
  ],
  organosPorMetrica: {},
  fuentes: {},
} as const satisfies GruposInput['scoring'];

function metric(id: string, numerador: number | null, denominador: number | null): MetricResult {
  const valor = numerador === null || denominador === null || denominador === 0 ? null : numerador / denominador;
  return {
    id,
    dimension: 'uno',
    estado: valor === null ? 'no_disponible' : 'observado',
    valor,
    numerador,
    denominador,
    percentil: null,
    percentil_grupo: null,
    n_grupo: null,
  };
}

function deputy(
  id: string,
  grupo: string,
  indice: number | null,
  dias: number,
  votos: [number, number] | null,
  preguntas: number,
  situacion: DeputyPeriod['situacion'] = 'ranking',
): DeputyPeriod {
  return {
    diputado_id: id,
    situacion,
    etapa_gobierno_excluida: false,
    dias_activo: dias,
    dias_gobierno: 0,
    dias_evaluados: dias,
    grupo_id: grupo,
    roles: [],
    metricas: [
      votos ? metric('votos', votos[0], votos[1]) : metric('votos', null, null),
      metric('preguntas', preguntas, dias),
      metric('sin_fuente', null, null),
    ],
    dimensiones: { uno: indice, dos: indice === null ? null : indice / 2 },
    indice,
    cobertura: indice === null ? null : 1,
    posicion: null,
    tiempo_palabra: { minutos: dias / 10, intervenciones: 2, sin_hora: 0 },
  };
}

const period: PeriodResult = {
  id: 'legislatura',
  nombre: 'Legislatura',
  estado: 'disponible',
  desde: '2024-01-01',
  hasta: '2024-12-31',
  dias_minimos: 90,
  poblacion_referencia: 4,
  total_ranking: 4,
  metricas_disponibles: ['votos', 'preguntas'],
  cobertura: 1,
  diputados: [
    deputy('A', 'GX', 80, 300, [9, 10], 3),
    deputy('B', 'GX', 40, 100, [10, 10], 0.5),
    deputy('C', 'GX', 60, 200, null, 0.5), // listed in no vote: skipped in that metric only
    deputy('D', 'GY', 20, 400, [5, 10], 8),
    deputy('E', 'GY', 99, 400, [10, 10], 100, 'gobierno'), // never counted
    deputy('F', 'GZ', null, 30, [1, 1], 1, 'periodo_insuficiente'),
  ],
};

const input: GruposInput = {
  scoring,
  legislatura: { number: 99, roman: 'XCIX', inicio: '2024-01-01', fin: undefined },
  fechaCalculo: '2024-12-31',
  periods: [
    period,
    {
      id: '1m',
      nombre: 'Último mes',
      estado: 'no_disponible',
      motivo: 'sin_actividad_en_el_periodo',
      dias_minimos: 15,
      poblacion_referencia: 0,
      total_ranking: 0,
      metricas_disponibles: [],
      cobertura: 0,
      diputados: [],
    },
  ],
  diputados: ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({
    diputado_id: id,
    nombre_completo: `Ficticio ${id}, Persona`,
    grupo_id: 'GX',
    fecha_alta: '2024-01-01',
    fecha_baja: undefined,
    cod_parlamentario: 1,
    nombre: 'Persona',
    apellidos: `Ficticio ${id}`,
    slug: `persona-ficticio-${id.toLowerCase()}`,
    // A and D ran on the same list but sit in different groups.
    formacion: id === 'A' ? 'LISTA-UNO' : id === 'D' ? 'Lista Uno (federación)' : 'LISTA-DOS',
    partido: id === 'A' || id === 'D' ? 'Lista Uno' : 'Lista Dos',
    circunscripcion: 'Ninguna',
    url_ficha_oficial: 'https://example.org',
  })),
  grupos: [
    { grupo_id: 'GX', nombre: 'Grupo Equis', nombre_corto: 'Equis' },
    { grupo_id: 'GY', nombre: 'Grupo Y griega', nombre_corto: 'Y griega' },
  ],
};

describe('quantile', () => {
  it('interpolates between the two nearest values', () => {
    expect(quantile([40, 60, 80], 0.5)).toBe(60);
    expect(quantile([40, 60, 80], 0.25)).toBe(50);
    expect(quantile([10, 20], 0.5)).toBe(15);
    expect(quantile([7], 0.75)).toBe(7);
    expect(quantile([1, 2, 3], 0)).toBe(1);
    expect(quantile([1, 2, 3], 1)).toBe(3);
  });

  it('is undefined for an empty list', () => {
    expect(quantile([], 0.5)).toBeUndefined();
  });
});

describe('buildGrupos', () => {
  const result = buildGrupos(input);
  const legislatura = result.periodos[0];
  const group = (id: string) => {
    const found = legislatura?.grupos.find((grupo) => grupo.id === id);
    if (!found) throw new Error(`group ${id} missing`);
    return found;
  };
  const value = (aggregate: { metricas: { id: string }[] }, id: string) =>
    aggregate.metricas.find((metrica) => metrica.id === id);

  it('carries the methodology version and lists the groups from largest to smallest', () => {
    expect(result).toMatchObject({ metodologia_version: '9.9.9', fecha_calculo: '2024-12-31' });
    expect(legislatura?.grupos.map((grupo) => [grupo.id, grupo.nombre_corto, grupo.diputados])).toEqual([
      ['GX', 'Equis', 3],
      ['GY', 'Y griega', 1],
      ['GZ', 'GZ', 0],
    ]);
  });

  it('counts only ranked deputies and says how many were left out', () => {
    expect(group('GY')).toMatchObject({ diputados: 1, gobierno: 1, periodo_insuficiente: 0, dias_evaluados: 400 });
    expect(group('GZ')).toMatchObject({ diputados: 0, periodo_insuficiente: 1, indice: null });
    expect(value(group('GZ'), 'votos')).toMatchObject({ estado: 'no_disponible', valor: null });
  });

  it('adds numerators and denominators instead of averaging rates', () => {
    // Votes: (9 + 10) cast of (10 + 10) listed; deputy C, listed in none, does not count.
    expect(value(group('GX'), 'votos')).toEqual({
      id: 'votos',
      estado: 'observado',
      total: 19,
      denominador: 20,
      valor: 0.95,
    });
    // Questions: 4 in 600 deputy-days = 0.6667 per 100 days (the mean of the three rates would be 0.5833).
    expect(value(group('GX'), 'preguntas')).toMatchObject({ total: 4, denominador: 600, valor: 0.6667 });
    expect(value(group('GY'), 'preguntas')).toMatchObject({ total: 8, valor: 2 });
  });

  it('keeps metrics without a source unavailable, never zero', () => {
    expect(value(group('GX'), 'sin_fuente')).toEqual({
      id: 'sin_fuente',
      estado: 'no_disponible',
      total: null,
      denominador: null,
      valor: null,
    });
  });

  it('summarizes how the indices and the dimensions of the deputies are spread', () => {
    expect(group('GX').indice).toEqual({ min: 40, p25: 50, mediana: 60, p75: 70, max: 80 });
    expect(group('GX').dimensiones).toEqual([
      { id: 'uno', mediana: 60 },
      { id: 'dos', mediana: 30 },
    ]);
    expect(group('GY').indice).toEqual({ min: 20, p25: 20, mediana: 20, p75: 20, max: 20 });
  });

  it('adds the speaking time as context', () => {
    expect(group('GX').tiempo_palabra).toEqual({ minutos: 60, intervenciones: 6, minutos_por_100_dias: 10 });
    expect(group('GZ').tiempo_palabra.minutos_por_100_dias).toBeNull();
  });

  it('gives the whole Chamber as the reference', () => {
    expect(legislatura?.camara).toMatchObject({ id: 'camara', diputados: 4, gobierno: 1, periodo_insuficiente: 1 });
    expect(value(legislatura?.camara ?? { metricas: [] }, 'preguntas')).toMatchObject({
      total: 12,
      denominador: 1000,
      valor: 1.2,
    });
  });

  it('groups by electoral list across parliamentary groups, with the census formations', () => {
    expect(
      legislatura?.candidaturas.map((lista) => [lista.id, lista.diputados, lista.gobierno, lista.formaciones]),
    ).toEqual([
      ['Lista Dos', 2, 1, ['LISTA-DOS']],
      ['Lista Uno', 2, 0, ['Lista Uno (federación)', 'LISTA-UNO']],
    ]);
    const uno = legislatura?.candidaturas.find((lista) => lista.id === 'Lista Uno');
    expect(uno?.indice).toMatchObject({ min: 20, mediana: 50, max: 80 });
  });

  it('leaves unavailable periods empty, with their reason', () => {
    expect(result.periodos[1]).toEqual({
      id: '1m',
      nombre: 'Último mes',
      estado: 'no_disponible',
      motivo: 'sin_actividad_en_el_periodo',
      desde: null,
      hasta: null,
      camara: null,
      grupos: [],
      candidaturas: [],
    });
  });
});
