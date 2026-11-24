/** Dates and XML of the sitemap. */
import { describe, expect, it } from 'vitest';

import { fechaMasReciente, ultimaActividad, xmlSitemap } from '../web/src/lib/sitemap.ts';

describe('fechaMasReciente', () => {
  it('returns the latest date and ignores the missing ones', () => {
    expect(fechaMasReciente('2026-09-30', null, '2026-11-23', undefined, '2025-01-01')).toBe('2026-11-23');
    expect(fechaMasReciente('2026-09-30T05:00:00Z', '2026-09-29')).toBe('2026-09-30');
    expect(fechaMasReciente(null, undefined, 'mañana')).toBeUndefined();
    expect(fechaMasReciente()).toBeUndefined();
  });
});

describe('ultimaActividad', () => {
  it('is the latest vote or speech', () => {
    const ficha = {
      ultimas_votaciones: [{ fecha: '2026-09-30' }, { fecha: '2026-09-23' }],
      ultimas_intervenciones: [{ fecha: '2026-10-02' }],
    } as Parameters<typeof ultimaActividad>[0];
    expect(ultimaActividad(ficha)).toBe('2026-10-02');
    expect(ultimaActividad({ ultimas_votaciones: [], ultimas_intervenciones: [] })).toBeUndefined();
  });
});

describe('xmlSitemap', () => {
  it('writes a date of change only where it is known', () => {
    const xml = xmlSitemap([{ path: '/', lastmod: '2026-11-23' }, { path: '/acerca' }], 'https://ejemplo.es');
    expect(xml).toContain('<url><loc>https://ejemplo.es/</loc><lastmod>2026-11-23</lastmod></url>');
    expect(xml).toContain('<url><loc>https://ejemplo.es/acerca</loc></url>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });
});
