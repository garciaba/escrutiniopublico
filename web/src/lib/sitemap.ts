/**
 * Dates of the sitemap (decision D-040). A page says it changed when its content did:
 * new activity of the deputy, a new version of the methodology or a published change
 * of the data. Not every day the pipeline runs, which search engines learn to ignore.
 */
import type { Ficha } from './data.ts';

/** The latest of some yyyy-mm-dd dates, ignoring the missing ones. */
export function fechaMasReciente(...fechas: (string | null | undefined)[]): string | undefined {
  const validas = fechas.filter(
    (fecha): fecha is string => typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fecha),
  );
  return validas.length === 0
    ? undefined
    : validas
        .map((fecha) => fecha.slice(0, 10))
        .sort()
        .at(-1);
}

/** Date of the latest vote or speech of a deputy in the data. */
export function ultimaActividad(
  ficha: Pick<Ficha, 'ultimas_votaciones' | 'ultimas_intervenciones'>,
): string | undefined {
  return fechaMasReciente(
    ...ficha.ultimas_votaciones.map((votacion) => votacion.fecha),
    ...ficha.ultimas_intervenciones.map((intervencion) => intervencion.fecha),
  );
}

export interface UrlSitemap {
  path: string;
  /** Absent when the date of the last real change is not known. */
  lastmod?: string;
}

export function xmlSitemap(urls: readonly UrlSitemap[], base: string): string {
  const filas = urls.map(({ path, lastmod }) => {
    const loc = `<loc>${new URL(path, base).href}</loc>`;
    return `  <url>${loc}${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${filas.join('\n')}\n</urlset>\n`;
}
