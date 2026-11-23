/**
 * Iniciativas family: bill files from open data, and the initiatives search export
 * for written questions (184) and information requests (186) with every signer (D-016).
 */
import { join } from 'node:path';

import { project } from '../../../config/project.ts';
import { decodeText } from '../../discover/profile.ts';
import { billsFile, parseOrThrow, searchInitiativesFile, type SearchInitiativeRow } from '../../normalize/schemas.ts';
import { withQuery, type IngestContext } from '../context.ts';
import { DAILY_DIR, recordDownload, writeAtomic } from '../raw-store.ts';
import { ingestStaticFile } from './static-file.ts';

const BILL_PREFIXES = ['ProyectosDeLey', 'ProposicionesDeLey', 'PropuestasDeReforma'] as const;

function searchUrl(resource: string): string {
  const { iniciativasBuscador } = project;
  return withQuery(project.baseUrl, iniciativasBuscador.path, {
    ...iniciativasBuscador.query,
    p_p_resource_id: resource,
  });
}

async function countInitiatives(ctx: IngestContext, tipo: string): Promise<number> {
  const response = await ctx.client.postForm(searchUrl(project.iniciativasBuscador.listResource), {
    _iniciativas_legislatura: project.legislatura.roman,
    _iniciativas_tipo: tipo,
    _iniciativas_paginaActual: '1',
  });
  const parsed = JSON.parse(decodeText(response.body)) as { iniciativas_encontradas?: number | string };
  const total = Number(parsed.iniciativas_encontradas);
  if (!Number.isInteger(total) || total < 0) throw new Error(`Unexpected count for type ${tipo}`);
  return total;
}

async function exportInitiatives(ctx: IngestContext, tipo: string, total: number): Promise<SearchInitiativeRow[]> {
  const { pageSize, exportResource } = project.iniciativasBuscador;
  const rows: SearchInitiativeRow[] = [];
  for (let fileIndex = 1; (fileIndex - 1) * pageSize < total; fileIndex++) {
    const response = await ctx.client.postForm(searchUrl(exportResource), {
      _iniciativas_legislatura: project.legislatura.roman,
      _iniciativas_tipo: tipo,
      _iniciativas_fileIndex: String(fileIndex),
      _iniciativas_fileType: 'json',
      _iniciativas_lastResult: String(Math.min(fileIndex * pageSize, total)),
    });
    rows.push(
      ...parseOrThrow(searchInitiativesFile, JSON.parse(decodeText(response.body)), `export ${tipo} #${fileIndex}`),
    );
  }
  return rows;
}

export async function ingestIniciativas(ctx: IngestContext, indexHtml: string): Promise<void> {
  for (const prefix of BILL_PREFIXES) {
    await ingestStaticFile(ctx, 'iniciativas', prefix, indexHtml, billsFile);
  }
  for (const { codigo } of project.iniciativasBuscador.tipos) {
    const total = await countInitiatives(ctx, codigo);
    const rows = await exportInitiatives(ctx, codigo, total);
    const unique = new Map(rows.map((row) => [row.id_iniciativa, row]));
    if (unique.size !== total) {
      throw new Error(`Initiatives search, type ${codigo}: expected ${total} records, exported ${unique.size}`);
    }
    const sorted = [...unique.values()].sort((a, b) => a.id_iniciativa.localeCompare(b.id_iniciativa));
    const bytes = new TextEncoder().encode(`${JSON.stringify(sorted, null, 1)}\n`);
    await writeAtomic(join(DAILY_DIR, 'iniciativas', `buscador-${codigo}.json`), bytes);
    recordDownload(
      ctx.manifest,
      `iniciativas/buscador-${codigo}`,
      searchUrl(project.iniciativasBuscador.exportResource),
      bytes,
      ctx.today,
    );
    ctx.log(`iniciativas/buscador-${codigo}: ${sorted.length} records`);
  }
}
