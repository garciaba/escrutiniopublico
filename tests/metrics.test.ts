/**
 * Scoring engine tests (specification, section 7). Every person, date and vote here
 * is fictitious and built in this file.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { formationToParty, groups } from '../config/parties.ts';
import { scoring } from '../config/scoring.ts';
import { periodWindow } from '../pipeline/metrics/dates.ts';
import {
  buildIndex,
  computeAllPeriods,
  computePeriod,
  minimumDays,
  type ScoringInput,
  type Tables,
} from '../pipeline/metrics/engine.ts';
import { competitionRanks, percentile } from '../pipeline/metrics/stats.ts';

const XV = { inicio: '2023-08-17', fin: '2026-10-06' };

describe('percentile', () => {
  it('follows P = 100 · (below + 0.5 · equal) / N', () => {
    const population = [1, 2, 2, 3];
    expect(percentile(population, 1)).toBe(12.5);
    expect(percentile(population, 2)).toBe(50);
    expect(percentile(population, 3)).toBe(87.5);
  });

  it('places a value from outside the population', () => {
    expect(percentile([1, 2, 2, 3], 2.5)).toBe(75);
    expect(percentile([], 1)).toBeUndefined();
  });
});

describe('competitionRanks', () => {
  it('gives tied scores the same position and skips the next', () => {
    expect(competitionRanks([90, 80, 80, 70])).toEqual([1, 2, 2, 4]);
  });
});

describe('periodWindow', () => {
  it('covers the whole legislature up to its end', () => {
    expect(periodWindow(undefined, '2026-11-23', XV)).toMatchObject({ desde: '2023-08-17', hasta: '2026-10-06' });
  });

  it('clips a rolling period to the legislature', () => {
    expect(periodWindow(365, '2026-11-23', XV)).toEqual({ desde: '2025-11-24', hasta: '2026-10-06', dias: 317 });
    expect(periodWindow(91, '2026-11-23', XV)).toMatchObject({ desde: '2026-08-25', dias: 43 });
  });

  it('is empty when the period starts after the legislature ended', () => {
    expect(periodWindow(30, '2026-11-23', XV)).toBeUndefined();
  });
});

describe('minimumDays', () => {
  it('is 90 days, or half of a short period', () => {
    expect(minimumDays(scoring, undefined)).toBe(90);
    expect(minimumDays(scoring, 365)).toBe(90);
    expect(minimumDays(scoring, 91)).toBe(46);
    expect(minimumDays(scoring, 30)).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// Fictitious chamber: 2024-01-01 to 2024-12-31 (366 days), six votes.
// ---------------------------------------------------------------------------
const LEG = { inicio: '2024-01-01', fin: undefined };
const FECHA = '2024-12-31';
const VOTE_DATES = ['2024-02-01', '2024-03-01', '2024-05-01', '2024-08-01', '2024-10-01', '2024-12-01'];

/** Deputy id -> group, start date and whether each of the six votes was cast (undefined = not in the roster). */
const CHAMBER: Record<string, { grupo: string; alta: string; cast: (boolean | undefined)[] }> = {
  A: { grupo: 'GX', alta: '2024-01-01', cast: [true, true, true, true, true, true] },
  B: { grupo: 'GX', alta: '2024-01-01', cast: [true, true, true, true, true, true] },
  C: { grupo: 'GX', alta: '2024-01-01', cast: [true, true, true, false, false, false] },
  D: { grupo: 'GY', alta: '2024-01-01', cast: [false, false, false, false, false, false] },
  // Joined in July: only the last three votes list her.
  E: { grupo: 'GY', alta: '2024-07-01', cast: [undefined, undefined, undefined, true, true, true] },
  // Joined in mid-November: 47 days, below the minimum.
  F: { grupo: 'GX', alta: '2024-11-15', cast: [undefined, undefined, undefined, undefined, undefined, true] },
  // Member of the Government all year.
  G: { grupo: 'GY', alta: '2024-01-01', cast: [true, true, false, false, false, false] },
  // Member of the Government until 1 April, an ordinary deputy afterwards.
  H: { grupo: 'GY', alta: '2024-01-01', cast: [false, false, true, true, true, true] },
  // Member of the Government until 1 September: 122 days outside it, fewer than inside.
  I: { grupo: 'GY', alta: '2024-01-01', cast: [true, true, true, true, true, true] },
};

function tables(overrides: Partial<Tables> = {}): Tables {
  const speech = (diputado_id: string, fecha: string, organo_id: string, cuenta = true) => ({
    diputado_id,
    fecha,
    organo_id,
    cuenta,
  });
  return {
    diputados: Object.entries(CHAMBER).map(([id, d]) => ({
      diputado_id: id,
      nombre_completo: `Ficticio ${id}, Persona`,
      grupo_id: d.grupo,
      fecha_alta: d.alta,
      fecha_baja: undefined,
    })),
    votaciones: VOTE_DATES.map((fecha, i) => ({ votacion_id: `V${i + 1}`, fecha })),
    votos: Object.entries(CHAMBER).flatMap(([id, d]) =>
      d.cast.flatMap((cast, i) =>
        cast === undefined
          ? []
          : [{ votacion_id: `V${i + 1}`, diputado_id: id, sentido: cast ? 'si' : 'no_vota', grupo_id: d.grupo }],
      ),
    ),
    organos: [
      { organo_id: 'pleno', tipo: 'pleno' },
      { organo_id: 'c1', tipo: 'comision' },
      { organo_id: 'sc', tipo: 'sesion_conjunta' },
    ],
    intervenciones: [
      ...['A', 'B'].flatMap((id) => [
        ...['2024-02-02', '2024-03-02', '2024-05-02', '2024-06-02'].map((fecha) => speech(id, fecha, 'pleno')),
        speech(id, '2024-04-10', 'c1'),
        speech(id, '2024-09-10', 'c1'),
      ]),
      speech('A', '2024-06-20', 'sc'), // joint session: counts for neither metric
      speech('A', '2024-06-21', 'pleno', false), // excluded speech
      speech('C', '2024-02-02', 'pleno'),
      speech('E', '2024-09-10', 'c1'),
      speech('E', '2024-10-10', 'c1'),
      speech('G', '2024-06-01', 'pleno'),
      speech('H', '2024-02-15', 'pleno'), // while in the Government: not evaluated
      speech('H', '2024-06-01', 'pleno'),
    ],
    iniciativas: [
      { iniciativa_id: '184/000001', tipo_codigo: '184', fecha_presentacion: '2024-03-10' },
      { iniciativa_id: '184/000002', tipo_codigo: '184', fecha_presentacion: '2024-04-10' },
      { iniciativa_id: '186/000001', tipo_codigo: '186', fecha_presentacion: '2024-05-05' },
      { iniciativa_id: '184/000003', tipo_codigo: '184', fecha_presentacion: '2024-02-10' },
    ],
    firmantes: [
      { iniciativa_id: '184/000001', diputado_id: 'A', orden: 1, n_firmantes: 2 },
      { iniciativa_id: '184/000001', diputado_id: 'B', orden: 2, n_firmantes: 2 },
      { iniciativa_id: '184/000002', diputado_id: 'C', orden: 1, n_firmantes: 1 },
      { iniciativa_id: '186/000001', diputado_id: 'C', orden: 1, n_firmantes: 1 },
      { iniciativa_id: '184/000003', diputado_id: 'H', orden: 1, n_firmantes: 1 }, // while in the Government
    ],
    pertenencias: [
      { diputado_id: 'A', organo_id: 'mesa', cargo: 'Presidenta', fecha_inicio: '2024-01-01', fecha_fin: undefined },
      {
        diputado_id: 'C',
        organo_id: 'junta-portavoces',
        cargo: 'Portavoces titulares',
        fecha_inicio: '2024-01-01',
        fecha_fin: '2024-03-01',
      },
    ],
    gobierno: [
      { diputado_id: 'G', from: '2023-06-01', until: undefined },
      { diputado_id: 'H', from: '2023-06-01', until: '2024-04-01' },
      { diputado_id: 'I', from: '2023-06-01', until: '2024-09-01' },
    ],
    ...overrides,
  };
}

function legislatura(t: Tables = tables(), config: ScoringInput = scoring, fecha = FECHA, leg = LEG) {
  const period = computeAllPeriods(t, config, leg, fecha).find((p) => p.id === 'legislatura');
  if (!period) throw new Error('legislatura period missing');
  const deputy = (id: string) => {
    const found = period.diputados.find((d) => d.diputado_id === id);
    if (!found) throw new Error(`deputy ${id} missing`);
    const metric = (metricId: string) => {
      const m = found.metricas.find((x) => x.id === metricId);
      if (!m) throw new Error(`metric ${metricId} missing`);
      return m;
    };
    return { ...found, metric };
  };
  return { period, deputy };
}

describe('scoring engine', () => {
  const { period, deputy } = legislatura();

  it('reports the period, its reference population and coverage', () => {
    expect(period).toMatchObject({
      estado: 'disponible',
      desde: '2024-01-01',
      hasta: '2024-12-31',
      dias_minimos: 90,
      poblacion_referencia: 6,
      total_ranking: 6,
      cobertura: 0.6,
    });
    expect(period.metricas_disponibles).toEqual([
      'votaciones_participacion',
      'intervenciones_pleno',
      'intervenciones_comision',
      'preguntas_escritas',
      'solicitudes_informe',
    ]);
  });

  it('counts only the votes whose roster lists a deputy who joined later', () => {
    const e = deputy('E');
    expect(e.dias_activo).toBe(184);
    expect(e.metric('votaciones_participacion')).toMatchObject({ numerador: 3, denominador: 3, valor: 1 });
    expect(e.metric('intervenciones_comision').valor).toBeCloseTo((100 * 2) / 184, 4);
    expect(e.situacion).toBe('ranking');
  });

  it('shows raw metrics without percentile or position below the minimum days', () => {
    const f = deputy('F');
    expect(f).toMatchObject({ situacion: 'periodo_insuficiente', dias_activo: 47, indice: null, posicion: null });
    expect(f.metric('votaciones_participacion')).toMatchObject({ valor: 1, percentil: null });
  });

  it('keeps members of the Government out of the ranking and of the reference population', () => {
    const g = deputy('G');
    expect(g).toMatchObject({ situacion: 'gobierno', dias_gobierno: 366, posicion: null });
    expect(g.roles).toContain('gobierno');
    // Raw metrics on all days, percentile against the reference population (one value below 2/6).
    expect(g.metric('votaciones_participacion')).toMatchObject({ numerador: 2, denominador: 6 });
    expect(g.metric('votaciones_participacion').percentil).toBeCloseTo(16.7, 1);
    expect(g.indice).not.toBeNull();
  });

  it('evaluates a former member of the Government only on the days outside it', () => {
    const h = deputy('H');
    expect(h).toMatchObject({
      situacion: 'ranking',
      etapa_gobierno_excluida: true,
      dias_activo: 366,
      dias_gobierno: 91,
      dias_evaluados: 275,
    });
    expect(h.metric('votaciones_participacion')).toMatchObject({ numerador: 4, denominador: 4 });
    expect(h.metric('intervenciones_pleno')).toMatchObject({ numerador: 1, denominador: 275 });
    expect(h.metric('preguntas_escritas').numerador).toBe(0);
  });

  it('does not rank a deputy who spent most of the period in the Government', () => {
    expect(deputy('I')).toMatchObject({
      situacion: 'gobierno',
      etapa_gobierno_excluida: false,
      dias_gobierno: 244,
      dias_evaluados: 366,
      posicion: null,
    });
  });

  it('ignores excluded speeches and joint sessions', () => {
    expect(deputy('A').metric('intervenciones_pleno').numerador).toBe(4);
    expect(deputy('A').metric('intervenciones_comision').numerador).toBe(2);
  });

  it('splits the credit of an initiative among its signers', () => {
    expect(deputy('A').metric('preguntas_escritas')).toMatchObject({
      estado: 'calculado',
      numerador: 0.5,
      denominador: 366,
      detalle: { firmadas: 1, primer_firmante: 1 },
    });
    expect(deputy('B').metric('preguntas_escritas').detalle).toEqual({ firmadas: 1, primer_firmante: 0 });
    expect(deputy('C').metric('solicitudes_informe').numerador).toBe(1);
  });

  it('computes percentiles, dimension scores and the global index', () => {
    const a = deputy('A');
    expect(a.metric('votaciones_participacion').percentil).toBeCloseTo(66.7, 1);
    expect(a.metric('intervenciones_pleno').percentil).toBeCloseTo(83.3, 1);
    expect(a.dimensiones).toMatchObject({ dedicacion: 66.7, debates: 75, iniciativa: 54.2 });
    expect(a.dimensiones.resultados).toBeNull();
    expect(a).toMatchObject({ indice: 65.3, cobertura: 0.6 });
    expect(deputy('C').indice).toBe(50);
    expect(deputy('D').indice).toBe(20.8);
  });

  it('gives tied indices the same position and skips the next one', () => {
    expect(deputy('A').indice).toBe(deputy('B').indice);
    expect([deputy('A').posicion, deputy('B').posicion]).toEqual([1, 1]);
    expect(deputy('E').posicion).toBe(3);
    expect(deputy('C').posicion).toBe(4);
    expect(deputy('H').posicion).toBe(5);
    expect(deputy('D').posicion).toBe(6);
  });

  it('adds the percentile inside the parliamentary group without using it in the score', () => {
    const metric = deputy('A').metric('votaciones_participacion');
    expect(metric.n_grupo).toBe(3);
    expect(metric.percentil_grupo).toBeCloseTo(66.7, 1);
  });

  it('labels the Presidency, the Mesa and group spokespersons', () => {
    expect(deputy('A').roles).toEqual(['mesa', 'presidencia']);
    expect(deputy('C').roles).toEqual(['portavoz']);
  });

  it('lists unavailable metrics with their reason and never as zero', () => {
    expect(deputy('A').metric('iniciativas_aprobadas')).toMatchObject({
      estado: 'no_disponible',
      valor: null,
      percentil: null,
    });
    expect(deputy('A').metric('iniciativas_aprobadas').motivo).toMatch(/autor/);
  });
});

describe('coverage rules', () => {
  const without = (...dimensions: string[]): ScoringInput => ({
    ...scoring,
    metricas: scoring.metricas.map((metric) =>
      dimensions.includes(metric.dimension) ? { ...metric, estado: 'no_disponible' as const } : metric,
    ),
  });

  it('redistributes the weight of a dimension without data', () => {
    const { period, deputy } = legislatura(tables(), without('iniciativa'));
    expect(period.cobertura).toBe(0.4);
    expect(deputy('A')).toMatchObject({ cobertura: 0.4, indice: 70.8 });
  });

  it('publishes no global index below the minimum coverage', () => {
    const { deputy } = legislatura(tables(), without('iniciativa', 'debates'));
    expect(deputy('A')).toMatchObject({ cobertura: 0.2, indice: null, posicion: null });
    expect(deputy('A').metric('votaciones_participacion').valor).toBe(1);
  });

  it('marks a metric unavailable for everyone when the Chamber had no such activity', () => {
    const { period, deputy } = legislatura(tables({ firmantes: [] }));
    expect(period.cobertura).toBe(0.4);
    expect(deputy('A').metric('preguntas_escritas')).toMatchObject({ estado: 'no_disponible', valor: null });
    expect(deputy('A').dimensiones.iniciativa).toBeNull();
  });
});

describe('periods', () => {
  const index = buildIndex(tables());
  const period = (id: string, fecha: string, leg: { inicio: string; fin: string | undefined }) => {
    const config = scoring.periodos.find((p) => p.id === id);
    if (!config) throw new Error(id);
    return computePeriod(tables(), index, scoring, leg, config, fecha);
  };

  it('has no last month when nothing happened in it', () => {
    expect(period('1m', '2024-12-31', LEG)).toMatchObject({
      estado: 'no_disponible',
      motivo: 'sin_actividad_en_el_periodo',
    });
  });

  it('keeps the last year available after the legislature ended', () => {
    const closed = { inicio: '2024-01-01', fin: '2024-06-30' };
    expect(period('12m', '2024-12-31', closed)).toMatchObject({ estado: 'disponible', hasta: '2024-06-30' });
    expect(period('3m', '2024-12-31', closed)).toMatchObject({
      estado: 'no_disponible',
      motivo: 'sin_dias_en_la_legislatura',
    });
    expect(period('3m', '2024-08-15', closed)).toMatchObject({
      estado: 'no_disponible',
      motivo: 'periodo_demasiado_corto',
    });
  });

  it('uses half of a short period as the minimum', () => {
    // Last quarter of the fictitious year: F (47 days) now qualifies.
    const quarter = period('3m', '2024-12-31', LEG);
    expect(quarter.dias_minimos).toBe(46);
    expect(quarter.diputados.find((d) => d.diputado_id === 'F')?.situacion).toBe('ranking');
  });
});

describe('config/scoring.ts', () => {
  const source = readFileSync(new URL('../config/scoring.ts', import.meta.url), 'utf-8');

  it('is neutral: it names no parliamentary group, party or formation', () => {
    expect(source).not.toMatch(/parties/);
    const names = [
      ...groups.flatMap((group) => [group.code, group.name, group.shortName]),
      ...Object.keys(formationToParty),
      ...Object.values(formationToParty),
    ];
    for (const name of new Set(names)) {
      const pattern = new RegExp(
        `(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`,
        'u',
      );
      expect(pattern.test(source), `scoring.ts mentions "${name}"`).toBe(false);
    }
  });

  it('is internally consistent', () => {
    const dimensionIds: string[] = scoring.dimensiones.map((dimension) => dimension.id);
    expect(scoring.dimensiones.reduce((sum, dimension) => sum + dimension.peso, 0)).toBe(100);
    for (const metric of scoring.metricas) expect(dimensionIds).toContain(metric.dimension);
    expect(new Set(scoring.metricas.map((metric) => metric.id)).size).toBe(scoring.metricas.length);
    expect(scoring.metodologiaVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(scoring.historial[0]?.version).toBe(scoring.metodologiaVersion);
  });
});
