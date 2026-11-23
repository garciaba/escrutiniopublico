/**
 * Reproducibility (specification, section 9): the versioned tables of data/normalized
 * and the calculation date regenerate data/derived byte for byte. Runs the real
 * metrics stage on the real data into a temporary folder.
 */
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DERIVED_DIR, runMetrics } from '../pipeline/metrics/run-metrics.ts';

interface Meta {
  fecha_calculo: string;
  ejecutado: string;
  commit: string | null;
}

describe('data/derived', () => {
  let outDir = '';
  let published: Meta;

  beforeAll(async () => {
    published = JSON.parse(await readFile(join(DERIVED_DIR, 'meta.json'), 'utf-8')) as Meta;
    outDir = await mkdtemp(join(tmpdir(), 'escrutinio-derived-'));
    await runMetrics(
      { fechaCalculo: published.fecha_calculo, ejecutado: published.ejecutado, commit: published.commit, outDir },
      () => undefined,
    );
  }, 120_000);

  afterAll(async () => {
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  it('regenerates ranking.json and meta.json from the versioned tables', async () => {
    for (const file of ['ranking.json', 'meta.json']) {
      expect(await readFile(join(outDir, file), 'utf-8'), file).toBe(await readFile(join(DERIVED_DIR, file), 'utf-8'));
    }
  });

  it('regenerates every profile', async () => {
    const files = (await readdir(join(DERIVED_DIR, 'diputados'))).sort();
    expect((await readdir(join(outDir, 'diputados'))).sort()).toEqual(files);
    for (const file of files) {
      const expected = await readFile(join(DERIVED_DIR, 'diputados', file), 'utf-8');
      expect(await readFile(join(outDir, 'diputados', file), 'utf-8'), file).toBe(expected);
    }
  });
});
