import type { APIRoute } from 'astro';
import { site } from '../../../config/site.ts';
import { fichaSlugs, loadMeta } from '../lib/data.ts';

/** Every public page, with the date of the last calculation as the modification date. */
export const GET: APIRoute = () => {
  const fecha = loadMeta().fecha_calculo;
  const paths = [
    '/',
    '/grupos',
    '/metodologia',
    '/datos',
    '/cambios',
    '/acerca',
    ...fichaSlugs().map((slug) => `/diputados/${slug}`),
  ];
  const urls = paths
    .map((path) => `  <url><loc>${new URL(path, site.url).href}</loc><lastmod>${fecha}</lastmod></url>`)
    .join('\n');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
