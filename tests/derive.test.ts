/** Output builders (ranking, profiles, metadata). Every person and date is fictitious. */
import { describe, expect, it } from 'vitest';

import { scoring } from '../config/scoring.ts';
import {
  buildFichas,
  buildMeta,
  buildRanking,
  serializeRanking,
  type DeriveInput,
} from '../pipeline/metrics/derive.ts';
import { buildIndex, computePeriod, type Tables } from '../pipeline/metrics/engine.ts';
import { parseCsv, toCsv } from '../pipeline/normalize/util.ts';

const legislatura = { number: 99, roman: 'XCIX', inicio: '2024-01-01', fin: undefined };
const fechaCalculo = '2024-12-31';

const diputados = ['Uno', 'Dos'].map((apellido, i) => ({
  diputado_id: `D${i + 1}`,
  nombre_completo: `Ficticio ${apellido}, Persona`,
  nombre: 'Persona',
  apellidos: `Ficticio ${apellido}`,
  slug: `persona-ficticio-${apellido.toLowerCase()}`,
  grupo_id: 'GX',
  formacion: 'FX',
  partido: 'PX',
  circunscripcion: 'Ninguna',
  cod_parlamentario: i + 1,
  fecha_alta: '2024-01-01',
  fecha_baja: undefined,
  url_ficha_oficial: `https://example.org/${i + 1}`,
}));
const votaciones = ['2024-02-01', '2024-03-01'].map((fecha, i) => ({
  votacion_id: `V${i + 1}`,
  fecha,
  titulo: `Votación ficticia ${i + 1}`,
  texto_expediente: 'Asunto ficticio',
  url_fuente: 'https://example.org/zip',
}));
const votos = [
  { votacion_id: 'V1', diputado_id: 'D1', sentido: 'si', grupo_id: 'GX', telematico: false },
  { votacion_id: 'V2', diputado_id: 'D1', sentido: 'no', grupo_id: 'GX', telematico: true },
  { votacion_id: 'V1', diputado_id: 'D2', sentido: 'no_vota', grupo_id: 'GX', telematico: false },
  { votacion_id: 'V2', diputado_id: 'D2', sentido: 'si', grupo_id: 'GX', telematico: false },
];
const intervenciones = [
  {
    intervencion_id: 'I1',
    fecha: '2024-02-01',
    organo_id: 'pleno',
    diputado_id: 'D1',
    cuenta: true,
    tipo_iniciativa: 'Tipo ficticio',
    motivo_exclusion: undefined,
    url_fuente: 'https://example.org/ds',
    url_video: 'https://example.org/v',
  },
];
const organos = [{ organo_id: 'pleno', tipo: 'pleno', nombre: 'Pleno' }];
const pertenencias = [
  { diputado_id: 'D1', organo_id: 'pleno', cargo: 'Vocales', fecha_inicio: '2024-01-01', fecha_fin: undefined },
];
const gobierno = [
  {
    diputado_id: 'D2',
    from: '2024-11-01',
    until: undefined,
    posts: 'Cargo ficticio',
    evidence: ['BOE-A-0000-0 (ficticio)'],
  },
];

function input(): DeriveInput {
  const tables: Tables = {
    diputados,
    votaciones,
    votos,
    intervenciones,
    organos,
    iniciativas: [
      {
        iniciativa_id: '121/000001',
        tipo_codigo: '121',
        fecha_presentacion: '2024-01-10',
        resultado: 'Aprobado con modificaciones',
        fecha_resultado: '2024-06-25',
      },
    ],
    firmantes: [],
    ponentes: [{ iniciativa_id: '121/000001', diputado_id: 'D1' }],
    pertenencias,
    gobierno,
  };
  const index = buildIndex(tables);
  return {
    scoring,
    legislatura,
    fechaCalculo,
    periods: scoring.periodos.map((period) => computePeriod(tables, index, scoring, legislatura, period, fechaCalculo)),
    index,
    diputados,
    grupos: [{ grupo_id: 'GX', nombre: 'Grupo ficticio', nombre_corto: 'Ficticio' }],
    organos,
    pertenencias,
    votaciones,
    votos,
    intervenciones,
    gobierno,
    leyes: [
      {
        iniciativa_id: '121/000001',
        tipo: 'Proyecto de ley',
        titulo: 'Proyecto de Ley ficticia.',
        resultado: 'Aprobado con modificaciones',
        fecha_resultado: '2024-06-25',
        url_fuente: 'https://example.org/121-1',
        ponentes: ['D1'],
      },
    ],
    fechasFuente: { votaciones: '2024-03-01', intervenciones: '2024-12-30' },
    limites: { ultimasVotaciones: 1, ultimasIntervenciones: 5 },
  };
}

describe('buildRanking', () => {
  const ranking = buildRanking(input());

  it('has one row per deputy and available period, with the methodology version', () => {
    expect(ranking.metodologia_version).toBe(scoring.metodologiaVersion);
    expect(ranking.legislatura).toMatchObject({ numero: 99, finalizada: false });
    const rows = ranking.filas.filter((row) => row.periodo === 'legislatura');
    expect(rows.map((row) => row.slug)).toEqual(['persona-ficticio-dos', 'persona-ficticio-uno']);
    expect(rows.find((row) => row.slug === 'persona-ficticio-uno')).toMatchObject({
      situacion: 'ranking',
      posicion: 1,
    });
    expect(ranking.periodos.find((period) => period.id === '1m')).toMatchObject({ estado: 'no_disponible' });
  });

  it('serializes one row per line and round-trips as JSON', () => {
    const text = serializeRanking(ranking);
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(ranking)));
    expect(text.split('\n').filter((line) => line.startsWith('  {"periodo"')).length).toBe(ranking.filas.length);
  });
});

describe('buildFichas', () => {
  const fichas = buildFichas(input());
  const uno = fichas.get('persona-ficticio-uno') as {
    periodos: Record<string, { estado: string; metricas?: { id: string; fuente?: { fecha_dato: string | null } }[] }>;
    evolucion: { meses: string[]; series: Record<string, (number | null)[]> };
    ultimas_votaciones: { votacion_id: string; sentido: string; telematico: boolean }[];
    ultimas_intervenciones: unknown[];
    cargos: { organo: string }[];
    ponencias: { iniciativa_id: string; resultado: string | null }[];
  };

  it('follows the metric contract, with the source and the date of its data', () => {
    const metric = uno.periodos.legislatura?.metricas?.find((m) => m.id === 'votaciones_participacion');
    expect(metric).toMatchObject({
      dimension: 'dedicacion',
      estado: 'observado',
      valor: 1,
      numerador: 2,
      denominador: 2,
      fuente: { url: 'https://www.congreso.es/es/opendata/votaciones', fecha_dato: '2024-03-01' },
    });
    expect(uno.periodos['1m']).toMatchObject({ estado: 'no_disponible' });
  });

  it('adds the monthly series, the latest votes and speeches, and the posts held', () => {
    expect(uno.evolucion.meses).toHaveLength(12);
    expect(uno.evolucion.series.votaciones_participacion?.slice(0, 3)).toEqual([null, 1, 1]);
    expect(uno.evolucion.series.intervenciones_pleno?.[1]).toBe(1);
    expect(uno.ultimas_votaciones).toEqual([
      expect.objectContaining({ votacion_id: 'V2', sentido: 'no', telematico: true }),
    ]);
    expect(uno.ultimas_intervenciones).toHaveLength(1);
    expect(uno.cargos[0]?.organo).toBe('Pleno');
  });

  it('lists the bills of the ponencia and their monthly series, and adds the speaking time', () => {
    expect(uno.ponencias).toEqual([
      expect.objectContaining({ iniciativa_id: '121/000001', resultado: 'Aprobado con modificaciones' }),
    ]);
    expect(uno.evolucion.series.leyes_ponente?.[5]).toBe(1);
    expect(uno.periodos.legislatura).toHaveProperty('tiempo_palabra');
    expect(fichas.get('persona-ficticio-dos')).toMatchObject({ ponencias: [] });
  });

  it('lists the Government terms with their evidence', () => {
    expect(fichas.get('persona-ficticio-dos')).toMatchObject({
      gobierno: [{ cargos: 'Cargo ficticio', desde: '2024-11-01', hasta: null }],
    });
  });
});

describe('buildMeta', () => {
  it('records the run, the commit, the record counts and the incidents', () => {
    const meta = buildMeta(input(), {
      ejecutado: '2024-12-31T05:40:00.000Z',
      commit: 'abc123',
      fuentes: [],
      registros: { diputados: 2 },
      incidencias: [{ tipo: '184', faltan: 4 }],
    });
    expect(meta).toMatchObject({
      ejecutado: '2024-12-31T05:40:00.000Z',
      commit: 'abc123',
      fecha_calculo: fechaCalculo,
    });
    expect(meta.registros.diputados).toBe(2);
    expect(meta.incidencias).toHaveLength(1);
  });
});

describe('parseCsv', () => {
  it('reads back what toCsv writes, including quotes, commas and line breaks', () => {
    const rows = [
      { id: 'a', texto: 'con "comillas", coma\ny salto', n: 3 },
      { id: 'b', texto: undefined, n: 0 },
    ];
    expect(parseCsv(toCsv(['id', 'texto', 'n'], rows, ['id']))).toEqual([
      { id: 'a', texto: 'con "comillas", coma\ny salto', n: '3' },
      { id: 'b', texto: '', n: '0' },
    ]);
  });

  it('accepts CRLF line endings and a missing final newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '' },
    ]);
  });

  it('rejects an unterminated quoted field', () => {
    expect(() => parseCsv('a\n"x')).toThrow(/Unterminated/);
  });
});
