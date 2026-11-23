/** Diputados family: census files (open data) and the deputy search with official codes (D-015). */
import { join } from 'node:path';

import { project } from '../../../config/project.ts';
import { decodeText } from '../../discover/profile.ts';
import { censusFile, parseOrThrow, searchDeputiesFile } from '../../normalize/schemas.ts';
import { reusable, withQuery, type IngestContext } from '../context.ts';
import { DAILY_DIR, recordDownload, writeAtomic } from '../raw-store.ts';
import { ingestStaticFile } from './static-file.ts';

export async function ingestDiputados(ctx: IngestContext, indexHtml: string): Promise<void> {
  await ingestStaticFile(ctx, 'diputados', 'DiputadosActivos', indexHtml, censusFile);
  await ingestStaticFile(ctx, 'diputados', 'DiputadosDeBaja', indexHtml, censusFile);

  const target = join(DAILY_DIR, 'diputados', 'busqueda.json');
  if (reusable(ctx, target)) return;
  const { fichaDiputado, legislatura } = project;
  const url = withQuery(project.baseUrl, fichaDiputado.path, fichaDiputado.searchQuery);
  const response = await ctx.client.postForm(url, {
    _diputadomodule_idLegislatura: String(legislatura.number),
    _diputadomodule_genero: '0',
    _diputadomodule_grupo: 'all',
    _diputadomodule_tipo: '2',
    _diputadomodule_nombre: '',
    _diputadomodule_apellidos: '',
    _diputadomodule_formacion: 'all',
    _diputadomodule_filtroProvincias: '[]',
    _diputadomodule_nombreCircunscripcion: '',
  });
  const parsed = parseOrThrow(searchDeputiesFile, JSON.parse(decodeText(response.body)), 'searchDiputados');
  await writeAtomic(target, response.body);
  recordDownload(ctx.manifest, 'diputados/busqueda', url, response.body, ctx.today);
  ctx.log(`diputados/busqueda: ${parsed.data.length} deputies with official code`);
}
