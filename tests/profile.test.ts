import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { decodeText, profileRecords } from '../pipeline/discover/profile.ts';

describe('profileRecords', () => {
  it('counts presence, filled values and distinct values per field', () => {
    const profile = profileRecords([
      { NOMBRE: 'A', FECHABAJA: '' },
      { NOMBRE: 'B', FECHABAJA: '06/10/2026' },
      { NOMBRE: 'B' },
    ]);
    expect(profile.rows).toBe(3);
    expect(profile.fields).toEqual([
      { field: 'NOMBRE', present: 3, nonEmpty: 3, distinct: 2, examples: ['A', 'B'] },
      { field: 'FECHABAJA', present: 2, nonEmpty: 1, distinct: 1, examples: ['06/10/2026'] },
    ]);
  });

  it('skips values that are not records and collapses whitespace in examples', () => {
    const profile = profileRecords([null, 'x', [1], { OBJETO: 'Proposición de Ley\nde reforma' }]);
    expect(profile.fields[0]?.examples).toEqual(['Proposición de Ley de reforma']);
  });
});

describe('decodeText', () => {
  it('drops the UTF-8 byte order mark of the CSV files', () => {
    const bytes = readFileSync(new URL('./fixtures/congreso/diputados/DiputadosActivos.sample.csv', import.meta.url));
    expect(decodeText(bytes).startsWith('NOMBRE;')).toBe(true);
  });

  it('decodes the ISO-8859-1 XML of the voting files', () => {
    const bytes = readFileSync(
      new URL('./fixtures/congreso/votaciones/sesion202votacion1.sample.xml', import.meta.url),
    );
    expect(decodeText(bytes)).toContain('Proposición no de Ley');
  });
});
