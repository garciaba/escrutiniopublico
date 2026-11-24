import type { APIRoute } from 'astro';
import { registro } from '../../../config/cambios.ts';
import { scoring } from '../../../config/scoring.ts';
import { site } from '../../../config/site.ts';
import { fichaSlugs, loadFicha } from '../lib/data.ts';
import { fechaMasReciente, ultimaActividad, xmlSitemap, type UrlSitemap } from '../lib/sitemap.ts';

/**
 * Every public page but the comparison, whose content depends on its query. Each one
 * dated by its last real change (decision D-040).
 */
export const GET: APIRoute = () => {
  const metodologia = fechaMasReciente(...scoring.historial.map((version) => version.fecha));
  /** A new methodology or a published change of the data reaches every page with figures. */
  const cambios = fechaMasReciente(metodologia, ...registro.map((entrada) => entrada.fecha));
  const fichas = fichaSlugs().map((slug) => ({ slug, actividad: ultimaActividad(loadFicha(slug)) }));
  const datos = fechaMasReciente(cambios, ...fichas.map((ficha) => ficha.actividad));
  const urls: UrlSitemap[] = [
    { path: '/', lastmod: datos },
    { path: '/diputados', lastmod: datos },
    { path: '/grupos', lastmod: datos },
    { path: '/metodologia', lastmod: metodologia },
    { path: '/datos', lastmod: datos },
    { path: '/cambios', lastmod: cambios },
    { path: '/acerca' },
    ...fichas.map(({ slug, actividad }) => ({
      path: `/diputados/${slug}`,
      lastmod: fechaMasReciente(cambios, actividad),
    })),
  ];
  return new Response(xmlSitemap(urls, site.url), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
