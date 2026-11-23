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

interface ListFilter {
  fechaDesde?: string;
  fechaHasta?: string;
}

/** Listing resource, 25 records per page; filters by registration date (fechaDe = 0). */
async function listPage(
  ctx: IngestContext,
  tipo: string,
  page: number,
  filter: ListFilter = {},
): Promise<{ total: number; rows: SearchInitiativeRow[] }> {
  const response = await ctx.client.postForm(searchUrl(project.iniciativasBuscador.listResource), {
    _iniciativas_legislatura: project.legislatura.roman,
    _iniciativas_tipo: tipo,
    _iniciativas_paginaActual: String(page),
    ...(filter.fechaDesde ? { _iniciativas_fechaDe: '0', _iniciativas_fechaDesde: filter.fechaDesde } : {}),
    ...(filter.fechaHasta ? { _iniciativas_fechaHasta: filter.fechaHasta } : {}),
  });
  const parsed = JSON.parse(decodeText(response.body)) as {
    iniciativas_encontradas?: number | string;
    lista_iniciativas?: Record<string, Record<string, unknown>>;
  };
  const total = Number(parsed.iniciativas_encontradas ?? 0);
  if (!Number.isInteger(total) || total < 0) throw new Error(`Unexpected count for type ${tipo}`);
  // The listing separates signers with "<br />"; the export with a space.
  const rows = Object.values(parsed.lista_iniciativas ?? {}).map((entry) => ({
    ...entry,
    autor: String(entry.autor ?? '').replace(/<br\s*\/?>/gi, ' '),
  }));
  return { total, rows: parseOrThrow(searchInitiativesFile, rows, `listing ${tipo} page ${page}`) };
}

async function countInitiatives(ctx: IngestContext, tipo: string, filter: ListFilter = {}): Promise<number> {
  return (await listPage(ctx, tipo, 1, filter)).total;
}

/** Attempts per export file: the resource sometimes answers 200 with an empty body. */
const EXPORT_ATTEMPTS = 4;

async function exportFile(
  ctx: IngestContext,
  tipo: string,
  fileIndex: number,
  total: number,
): Promise<SearchInitiativeRow[] | undefined> {
  const { pageSize, exportResource, retryDelayMs } = project.iniciativasBuscador;
  for (let attempt = 1; ; attempt++) {
    const response = await ctx.client.postForm(searchUrl(exportResource), {
      _iniciativas_legislatura: project.legislatura.roman,
      _iniciativas_tipo: tipo,
      _iniciativas_fileIndex: String(fileIndex),
      _iniciativas_fileType: 'json',
      _iniciativas_lastResult: String(Math.min(fileIndex * pageSize, total)),
    });
    const text = decodeText(response.body).trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      if (attempt >= EXPORT_ATTEMPTS) {
        ctx.log(`iniciativas: export ${tipo} #${fileIndex} failed ${attempt} times (${text.length} bytes)`);
        return undefined;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
      continue;
    }
    // A schema failure is a format change, not a transient error: no retry.
    return parseOrThrow(searchInitiativesFile, parsed, `export ${tipo} #${fileIndex}`);
  }
}

async function exportInitiatives(ctx: IngestContext, tipo: string, total: number): Promise<SearchInitiativeRow[]> {
  const { pageSize } = project.iniciativasBuscador;
  const rows: SearchInitiativeRow[] = [];
  for (let fileIndex = 1; (fileIndex - 1) * pageSize < total; fileIndex++) {
    rows.push(...((await exportFile(ctx, tipo, fileIndex, total)) ?? []));
  }
  return rows;
}

/** Months (first and last day, dd/mm/yyyy) from the start of the legislature to `today`. */
export function monthWindows(from: string, today: string): { desde: string; hasta: string; key: string }[] {
  const windows: { desde: string; hasta: string; key: string }[] = [];
  const [startYear = 0, startMonth = 1] = from.split('-').map(Number);
  const [endYear = 0, endMonth = 1] = today.split('-').map(Number);
  for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth);) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mm = String(month).padStart(2, '0');
    windows.push({ desde: `01/${mm}/${year}`, hasta: `${last}/${mm}/${year}`, key: `${year}-${mm}` });
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return windows;
}

/**
 * Some export files fail on the server for every format. The listing still serves those
 * records, so missing ones are recovered month by month: months whose listing count
 * exceeds the exported rows are read in full from the listing (25 per page).
 */
async function recoverFromListing(
  ctx: IngestContext,
  tipo: string,
  rows: Map<string, SearchInitiativeRow>,
): Promise<number> {
  const exportedPerMonth = new Map<string, number>();
  for (const row of rows.values()) {
    const [, month = '', year = ''] = row.fecha_presentado.split('/');
    const key = `${year}-${month}`;
    exportedPerMonth.set(key, (exportedPerMonth.get(key) ?? 0) + 1);
  }
  let recovered = 0;
  for (const window of monthWindows(project.legislatura.inicio, ctx.today)) {
    const filter = { fechaDesde: window.desde, fechaHasta: window.hasta };
    const listed = await countInitiatives(ctx, tipo, filter);
    if (listed <= (exportedPerMonth.get(window.key) ?? 0)) continue;
    for (let page = 1; (page - 1) * 25 < listed; page++) {
      for (const row of (await listPage(ctx, tipo, page, filter)).rows) {
        if (!rows.has(row.id_iniciativa)) {
          rows.set(row.id_iniciativa, row);
          recovered++;
        }
      }
    }
    ctx.log(`iniciativas: ${tipo} ${window.key}: listing ${listed}, exported ${exportedPerMonth.get(window.key) ?? 0}`);
  }
  return recovered;
}

export async function ingestIniciativas(ctx: IngestContext, indexHtml: string): Promise<void> {
  for (const prefix of BILL_PREFIXES) {
    await ingestStaticFile(ctx, 'iniciativas', prefix, indexHtml, billsFile);
  }
  for (const { codigo } of project.iniciativasBuscador.tipos) {
    const total = await countInitiatives(ctx, codigo);
    const rows = await exportInitiatives(ctx, codigo, total);
    const unique = new Map(rows.map((row) => [row.id_iniciativa, row]));
    if (unique.size < total) {
      const recovered = await recoverFromListing(ctx, codigo, unique);
      ctx.log(`iniciativas: ${codigo}: ${recovered} records recovered from the listing`);
    }
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
