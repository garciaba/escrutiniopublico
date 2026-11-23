import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { project } from '../config/project.ts';
import {
  extractDownloadLinks,
  extractSessionZips,
  extractVotingDays,
  pickDatasetLink,
  votingDayUrl,
} from '../pipeline/ingest/index-page.ts';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/congreso/index/${name}`, import.meta.url), 'utf-8');
const base = project.baseUrl;

describe('extractDownloadLinks', () => {
  const links = extractDownloadLinks(fixture('diputados.sample.html'), base);

  it('reads only timestamped data files, as absolute URLs', () => {
    expect(links.every((link) => link.url.startsWith('https://www.congreso.es/webpublica/opendata/'))).toBe(true);
    expect(links.some((link) => link.url.includes('update_language'))).toBe(false);
  });

  it('parses prefix, timestamp and format from the file name', () => {
    expect(links).toContainEqual({
      url: 'https://www.congreso.es/webpublica/opendata/diputados/DiputadosActivos__20261123050006.json',
      fileName: 'DiputadosActivos__20261123050006.json',
      prefix: 'DiputadosActivos',
      timestamp: '20261123050006',
      format: 'json',
    });
  });

  it('does not confuse DiputadosActivos with other prefixes', () => {
    const prefixes = new Set(links.map((link) => link.prefix));
    expect(prefixes).toEqual(new Set(['DiputadosActivos', 'docacteco', 'DiputadosDeBaja']));
  });
});

describe('pickDatasetLink', () => {
  const links = extractDownloadLinks(fixture('diputados.sample.html'), base);

  it('prefers JSON', () => {
    expect(pickDatasetLink(links, 'DiputadosActivos', ['json', 'csv', 'xml'])?.format).toBe('json');
  });

  it('falls back to the next format', () => {
    const withoutJson = links.filter((link) => link.format !== 'json');
    expect(pickDatasetLink(withoutJson, 'DiputadosActivos', ['json', 'csv', 'xml'])?.format).toBe('csv');
  });

  it('takes the newest timestamp when a format repeats', () => {
    const older = {
      url: 'https://www.congreso.es/webpublica/opendata/x/X__20250101000000.json',
      fileName: 'X__20250101000000.json',
      prefix: 'X',
      format: 'json' as const,
      timestamp: '20250101000000',
    };
    const newer = { ...older, timestamp: '20260101000000' };
    expect(pickDatasetLink([older, newer], 'X', ['json'])?.timestamp).toBe('20260101000000');
  });

  it('returns undefined for an unknown prefix', () => {
    expect(pickDatasetLink(links, 'NoExiste', ['json'])).toBeUndefined();
  });
});

describe('extractVotingDays', () => {
  const days = extractVotingDays(fixture('votaciones.sample.html'));

  it('reads the embedded calendar of the XV legislature', () => {
    expect(days).toHaveLength(147);
    expect(days[0]).toBe('20230919');
    expect(days.at(-1)).toBe('20261002');
  });

  it('returns an empty list when the calendar is missing', () => {
    expect(extractVotingDays('<html></html>')).toEqual([]);
  });
});

describe('extractSessionZips', () => {
  it('reads session, date and legislature from the ZIP path', () => {
    expect(extractSessionZips(fixture('votaciones-dia-20260930.sample.html'), base)).toEqual([
      {
        url: 'https://www.congreso.es/webpublica/opendata/votaciones/Leg15/Sesion202/20260930/VOT_20260930153631.zip',
        legislatura: 15,
        sesion: 202,
        fecha: '20260930',
        fileName: 'VOT_20260930153631.zip',
      },
    ]);
  });

  it('ignores per-vote files', () => {
    const zips = extractSessionZips(fixture('votaciones-dia-20260930.sample.html'), base);
    expect(zips.every((zip) => zip.fileName.endsWith('.zip'))).toBe(true);
  });
});

describe('votingDayUrl', () => {
  it('formats the target date as dd/mm/yyyy', () => {
    const url = new URL(
      votingDayUrl(base, project.votaciones.dayPagePath, project.votaciones.dayPageQuery, 'XV', '20260930'),
    );
    expect(url.searchParams.get('targetDate')).toBe('30/09/2026');
    expect(url.searchParams.get('targetLegislatura')).toBe('XV');
    expect(url.searchParams.get('p_p_id')).toBe('votaciones');
  });
});
