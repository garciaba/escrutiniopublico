/** Pre-publication sanity checks and the daily commit message. Every figure is fictitious. */
import { describe, expect, it } from 'vitest';

import {
  checkActiveDeputies,
  checkAssignment,
  checkRowLoss,
  checkScoreJumps,
  type Snapshot,
} from '../pipeline/sanity/checks.ts';
import { dailySummary, type SummaryInput } from '../pipeline/sanity/summary.ts';

const T = {
  activeDeputiesMin: 340,
  activeDeputiesMax: 350,
  maxRowLossPct: 5,
  maxUnassignedPct: 0.5,
  maxDailyScoreJump: 15,
};

function snapshot(
  indices: (number | null)[],
  registros: Record<string, number> = { votaciones: 10 },
  version = '1.0.0',
): Snapshot {
  return {
    meta: { metodologia_version: version, legislatura: { finalizada: false }, registros },
    ranking: {
      filas: indices.map((indice, i) => ({ periodo: 'legislatura', slug: `d${i}`, nombre: `Ficticio ${i}`, indice })),
    },
  };
}

describe('checkActiveDeputies', () => {
  it('requires between 340 and 350 deputies in office', () => {
    expect(checkActiveDeputies(350, false, T).estado).toBe('ok');
    expect(checkActiveDeputies(339, false, T).estado).toBe('fallo');
    expect(checkActiveDeputies(351, false, T).detalle).toContain('351');
  });

  it('does not apply once the legislature is over', () => {
    expect(checkActiveDeputies(137, true, T)).toMatchObject({ estado: 'omitido' });
  });
});

describe('checkRowLoss', () => {
  it('fails when a table loses more than 5 % of its rows', () => {
    expect(checkRowLoss({ votos: 95 }, { votos: 100 }, T).estado).toBe('ok');
    const result = checkRowLoss({ votos: 94, firmantes: 10 }, { votos: 100, firmantes: 10 }, T);
    expect(result.estado).toBe('fallo');
    expect(result.detalle).toContain('votos: de 100 a 94');
  });

  it('treats a table that disappears as a total loss', () => {
    expect(checkRowLoss({}, { ponentes: 10 }, T).estado).toBe('fallo');
  });

  it('is skipped on the first run', () => {
    expect(checkRowLoss({ votos: 1 }, undefined, T).estado).toBe('omitido');
  });
});

describe('checkAssignment', () => {
  it('tolerates up to 0.5 % of rows without a census deputy and lists them', () => {
    const ok = checkAssignment([{ tabla: 'votos', total: 1000, sinAsignar: ['V1', 'V2'] }], T);
    expect(ok.estado).toBe('ok');
    expect(ok.detalle).toContain('votos: V1, V2');
    expect(checkAssignment([{ tabla: 'votos', total: 100, sinAsignar: ['V1'] }], T).estado).toBe('fallo');
  });

  it('reports a clean assignment', () => {
    expect(checkAssignment([{ tabla: 'votos', total: 10, sinAsignar: [] }], T).detalle).toMatch(/Las 10 filas/);
  });
});

describe('checkScoreJumps', () => {
  it('fails when an index moves more than 15 points without new sessions', () => {
    const result = checkScoreJumps(snapshot([50, 70]), snapshot([50, 54.9]), T);
    expect(result.estado).toBe('fallo');
    expect(result.detalle).toContain('Ficticio 1 (legislatura): 54.9 → 70');
  });

  it('accepts moves within the limit and ignores deputies without index', () => {
    expect(checkScoreJumps(snapshot([50, 65, null]), snapshot([50, 50, 40]), T).estado).toBe('ok');
  });

  it('is skipped after new sessions, with a new methodology or on the first run', () => {
    expect(checkScoreJumps(snapshot([90], { votaciones: 11 }), snapshot([10]), T).estado).toBe('omitido');
    expect(checkScoreJumps(snapshot([90], { votaciones: 10 }, '1.1.0'), snapshot([10]), T).estado).toBe('omitido');
    expect(checkScoreJumps(snapshot([90]), undefined, T).estado).toBe('omitido');
  });
});

describe('dailySummary', () => {
  const day = (overrides: Partial<SummaryInput>): SummaryInput => ({
    fecha: '2024-12-31',
    metodologia: '1.0.0',
    registros: { intervenciones: 100, iniciativas: 50 },
    votaciones: new Map([['L99-S001-V001', '1']]),
    diputados: new Map([
      ['D1', ''],
      ['D2', ''],
    ]),
    ...overrides,
  });

  it('says so when the official data did not change', () => {
    expect(dailySummary(day({}), day({ fecha: '2024-12-30' }))).toBe(
      'Daily data check 2024-12-31: no changes in the official data\n',
    );
  });

  it('lists new sessions, new rows, deputies who joined or left and a new methodology', () => {
    const message = dailySummary(
      day({
        registros: { intervenciones: 112, iniciativas: 49 },
        votaciones: new Map([
          ['L99-S001-V001', '1'],
          ['L99-S002-V001', '2'],
          ['L99-S002-V002', '2'],
          ['L99-S003-V001', '3'],
        ]),
        diputados: new Map([
          ['D1', ''],
          ['D2', '2024-12-31'],
          ['D3', ''],
        ]),
        metodologia: '1.1.0',
      }),
      day({}),
    );
    expect(message).toBe(
      [
        'Daily data update 2024-12-31: 2 new sessions',
        '',
        '- 2 new plenary sessions (3 votes)',
        '- Rows: intervenciones +12, iniciativas -1',
        '- 1 deputy joined',
        '- 1 deputy left',
        '- Methodology 1.0.0 -> 1.1.0',
        '',
      ].join('\n'),
    );
  });

  it('reports tables the source revised in place, without a change in their size', () => {
    expect(dailySummary(day({ modificadas: ['iniciativas'] }), day({ fecha: '2024-12-30' }))).toBe(
      ['Daily data update 2024-12-31', '', '- Records revised, same number of rows: iniciativas', ''].join('\n'),
    );
  });

  it('does not repeat as revised a table whose number of rows changed', () => {
    const message = dailySummary(
      day({ registros: { intervenciones: 101, iniciativas: 50 }, modificadas: ['iniciativas', 'intervenciones'] }),
      day({ fecha: '2024-12-30' }),
    );
    expect(message).toBe(
      [
        'Daily data update 2024-12-31',
        '',
        '- Rows: intervenciones +1',
        '- Records revised, same number of rows: iniciativas',
        '',
      ].join('\n'),
    );
  });

  it('marks the first run', () => {
    expect(dailySummary(day({}), undefined)).toBe('Daily data update 2024-12-31: first run\n');
  });
});
