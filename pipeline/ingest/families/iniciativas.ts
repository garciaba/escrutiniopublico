/**
 * Iniciativas family: bill files from open data, and the initiatives search export
 * for written questions (184) and information requests (186) with every signer (D-016).
 *
 * The export serves blocks of 100, ordered by qualification date (newest first). Some
 * blocks fail on the server for every format, because one record breaks the query.
 * Those records are recovered from the paginated listing (25 per page), querying the
 * qualification days the failed block covers and, when a listing page fails too,
 * slicing the query by group and then by deputy. Whatever cannot be served at all is
 * reported in data/raw/iniciativas-incidencias.json; above a configured limit the run
 * stops (decision D-022).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { groups } from '../../../config/parties.ts';
import { project } from '../../../config/project.ts';
import { decodeText } from '../../discover/profile.ts';
import {
  billsFile,
  parseOrThrow,
  searchDeputiesFile,
  searchInitiativesFile,
  type SearchInitiativeRow,
} from '../../normalize/schemas.ts';
import { reusable, withQuery, type IngestContext } from '../context.ts';
import { DAILY_DIR, RAW_DIR, recordDownload, writeAtomic } from '../raw-store.ts';
import { ingestStaticFile } from './static-file.ts';

const BILL_PREFIXES = ['ProyectosDeLey', 'ProposicionesDeLey', 'PropuestasDeReforma'] as const;
const LISTING_PAGE_SIZE = 25;
const MAX_LISTING_PAGES = 40;
/** Attempts per export file: the resource sometimes answers 200 with an empty body. */
const EXPORT_ATTEMPTS = 4;

function searchUrl(resource: string): string {
  const { iniciativasBuscador } = project;
  return withQuery(project.baseUrl, iniciativasBuscador.path, {
    ...iniciativasBuscador.query,
    p_p_resource_id: resource,
  });
}

/** Listing filters. `fechaDe`: 0 = registration date, 1 = qualification date. */
export interface ListFilter {
  fechaDe?: '0' | '1';
  fechaDesde?: string;
  fechaHasta?: string;
  autor?: string;
}

type ListPage = { ok: true; total: number; rows: SearchInitiativeRow[] } | { ok: false };

async function listPage(ctx: IngestContext, tipo: string, page: number, filter: ListFilter): Promise<ListPage> {
  const response = await ctx.client.postForm(searchUrl(project.iniciativasBuscador.listResource), {
    _iniciativas_legislatura: project.legislatura.roman,
    _iniciativas_tipo: tipo,
    _iniciativas_paginaActual: String(page),
    ...(filter.fechaDesde
      ? { _iniciativas_fechaDe: filter.fechaDe ?? '0', _iniciativas_fechaDesde: filter.fechaDesde }
      : {}),
    ...(filter.fechaHasta ? { _iniciativas_fechaHasta: filter.fechaHasta } : {}),
    ...(filter.autor ? { _iniciativas_autor: filter.autor } : {}),
  });
  const parsed = JSON.parse(decodeText(response.body)) as {
    error?: string;
    iniciativas_encontradas?: number | string;
    lista_iniciativas?: Record<string, Record<string, unknown>>;
  };
  // A page that contains a broken record answers {"error": "Error en la consulta"}.
  if (parsed.error) return { ok: false };
  const total = Number(parsed.iniciativas_encontradas ?? 0);
  if (!Number.isInteger(total) || total < 0) throw new Error(`Unexpected count for type ${tipo}`);
  // The listing separates signers with "<br />"; the export with a space.
  const rows = Object.values(parsed.lista_iniciativas ?? {}).map((entry) => ({
    ...entry,
    autor: String(entry.autor ?? '').replace(/<br\s*\/?>/gi, ' '),
  }));
  return { ok: true, total, rows: parseOrThrow(searchInitiativesFile, rows, `listing ${tipo} page ${page}`) };
}

async function countInitiatives(ctx: IngestContext, tipo: string): Promise<number> {
  const first = await listPage(ctx, tipo, 1, {});
  if (!first.ok) throw new Error(`Cannot count initiatives of type ${tipo}`);
  return first.total;
}

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

/** dd/mm/yyyy -> yyyymmdd, for comparisons. */
function sortable(date: string): string {
  const [day = '', month = '', year = ''] = date.split('/');
  return `${year}${month}${day}`;
}

/** Every day between two dd/mm/yyyy dates, both included. */
export function daysBetween(from: string, to: string): string[] {
  const start = new Date(`${sortable(from).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}T00:00:00Z`);
  const end = new Date(`${sortable(to).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}T00:00:00Z`);
  const days: string[] = [];
  for (const cursor = start; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = cursor.toISOString();
    days.push(`${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`);
  }
  return days;
}

/**
 * Qualification days covered by failed export blocks, read from the nearest blocks
 * that did come back (the export is ordered by qualification date, newest first).
 */
export function failedBlockDays(blocks: readonly (SearchInitiativeRow[] | undefined)[]): string[] {
  const days = new Set<string>();
  blocks.forEach((block, index) => {
    if (block !== undefined) return;
    const newer = blocks
      .slice(0, index)
      .reverse()
      .find((b) => b && b.length > 0);
    const older = blocks.slice(index + 1).find((b) => b && b.length > 0);
    const dates = (rows: SearchInitiativeRow[] | undefined) =>
      (rows ?? []).map((row) => row.fecha_calificado).filter((date) => date !== '');
    const upper = dates(newer).sort((a, b) => sortable(a).localeCompare(sortable(b)))[0];
    const lower = dates(older).sort((a, b) => sortable(b).localeCompare(sortable(a)))[0];
    if (!upper || !lower) throw new Error(`Cannot date failed export block #${index + 1}`);
    for (const day of daysBetween(lower, upper)) days.add(day);
  });
  return [...days];
}

interface Recovery {
  rows: Map<string, SearchInitiativeRow>;
  /** Listing queries that still failed after slicing down to one deputy. */
  failedQueries: string[];
}

/** Reads every page of a listing query; returns false if any page failed. */
async function harvest(ctx: IngestContext, tipo: string, filter: ListFilter, recovery: Recovery): Promise<boolean> {
  const first = await listPage(ctx, tipo, 1, filter);
  let ok = first.ok;
  // A failed first page gives no total: read on until a page comes back short or empty,
  // never past the ~1,000 results the listing pages through.
  const total = first.ok ? first.total : MAX_LISTING_PAGES * LISTING_PAGE_SIZE;
  if (first.ok) for (const row of first.rows) recovery.rows.set(row.id_iniciativa, row);
  for (let page = 2; (page - 1) * LISTING_PAGE_SIZE < total; page++) {
    const result = await listPage(ctx, tipo, page, filter);
    if (!result.ok) {
      ok = false;
      continue;
    }
    for (const row of result.rows) recovery.rows.set(row.id_iniciativa, row);
    if (!first.ok && result.rows.length < LISTING_PAGE_SIZE) break;
    if (result.rows.length === 0) break;
  }
  return ok;
}

async function deputyNamesByGroup(): Promise<Map<string, string[]>> {
  const search = parseOrThrow(
    searchDeputiesFile,
    JSON.parse(await readFile(join(DAILY_DIR, 'diputados', 'busqueda.json'), 'utf-8')),
    'busqueda.json',
  );
  const codeByName = new Map(groups.map((group) => [group.name, group.code]));
  const byGroup = new Map<string, string[]>();
  for (const deputy of search.data) {
    const code = codeByName.get(deputy.grupo);
    if (code) byGroup.set(code, [...(byGroup.get(code) ?? []), deputy.apellidosNombre]);
  }
  return byGroup;
}

/** Day -> groups -> deputies, slicing further only where a listing page fails. */
async function recoverDays(
  ctx: IngestContext,
  tipo: string,
  days: readonly string[],
  recovery: Recovery,
): Promise<void> {
  const deputies = await deputyNamesByGroup();
  for (const day of days) {
    const base: ListFilter = { fechaDe: '1', fechaDesde: day, fechaHasta: day };
    if (await harvest(ctx, tipo, base, recovery)) continue;
    for (const group of groups) {
      if (await harvest(ctx, tipo, { ...base, autor: group.code }, recovery)) continue;
      for (const name of deputies.get(group.code) ?? []) {
        if (!(await harvest(ctx, tipo, { ...base, autor: name }, recovery))) {
          recovery.failedQueries.push(`${day} ${name}`);
        }
      }
    }
  }
}

export interface InitiativesIncident {
  tipo: string;
  total_oficial: number;
  obtenidas: number;
  faltan: number;
  bloques_fallidos: number[];
  consultas_fallidas: string[];
}

export async function ingestIniciativas(ctx: IngestContext, indexHtml: string): Promise<void> {
  for (const prefix of BILL_PREFIXES) {
    await ingestStaticFile(ctx, 'iniciativas', prefix, indexHtml, billsFile);
  }
  const incidentsPath = join(RAW_DIR, 'iniciativas-incidencias.json');
  let previous: InitiativesIncident[] = [];
  try {
    previous = JSON.parse(await readFile(incidentsPath, 'utf-8')) as InitiativesIncident[];
  } catch {
    // First run: no incident file yet.
  }
  const incidents: InitiativesIncident[] = [];
  for (const { codigo } of project.iniciativasBuscador.tipos) {
    if (reusable(ctx, join(DAILY_DIR, 'iniciativas', `buscador-${codigo}.json`))) {
      incidents.push(...previous.filter((incident) => incident.tipo === codigo));
      continue;
    }
    const total = await countInitiatives(ctx, codigo);
    const blocks: (SearchInitiativeRow[] | undefined)[] = [];
    for (let fileIndex = 1; (fileIndex - 1) * project.iniciativasBuscador.pageSize < total; fileIndex++) {
      blocks.push(await exportFile(ctx, codigo, fileIndex, total));
    }
    const recovery: Recovery = {
      rows: new Map(blocks.flatMap((block) => block ?? []).map((row) => [row.id_iniciativa, row])),
      failedQueries: [],
    };
    const failedBlocks = blocks.flatMap((block, index) => (block === undefined ? [index + 1] : []));
    if (failedBlocks.length > 0) {
      const before = recovery.rows.size;
      await recoverDays(ctx, codigo, failedBlockDays(blocks), recovery);
      ctx.log(`iniciativas: ${codigo}: ${recovery.rows.size - before} records recovered from the listing`);
    }
    const missing = total - recovery.rows.size;
    if (missing < 0)
      throw new Error(
        `Initiatives search, type ${codigo}: more records (${recovery.rows.size}) than the official total (${total})`,
      );
    if (missing > project.iniciativasBuscador.maxUnavailable) {
      throw new Error(
        `Initiatives search, type ${codigo}: ${missing} of ${total} records unavailable (limit ${project.iniciativasBuscador.maxUnavailable})`,
      );
    }
    if (failedBlocks.length > 0 || missing > 0) {
      incidents.push({
        tipo: codigo,
        total_oficial: total,
        obtenidas: recovery.rows.size,
        faltan: missing,
        bloques_fallidos: failedBlocks,
        consultas_fallidas: [...new Set(recovery.failedQueries)].sort(),
      });
    }
    const sorted = [...recovery.rows.values()].sort((a, b) => a.id_iniciativa.localeCompare(b.id_iniciativa));
    const bytes = new TextEncoder().encode(`${JSON.stringify(sorted, null, 1)}\n`);
    await writeAtomic(join(DAILY_DIR, 'iniciativas', `buscador-${codigo}.json`), bytes);
    recordDownload(
      ctx.manifest,
      `iniciativas/buscador-${codigo}`,
      searchUrl(project.iniciativasBuscador.exportResource),
      bytes,
      ctx.today,
    );
    ctx.log(
      `iniciativas/buscador-${codigo}: ${sorted.length} of ${total} records${missing > 0 ? ` (${missing} unavailable)` : ''}`,
    );
  }
  // Versioned and published: what the official search could not serve, and why.
  await writeAtomic(incidentsPath, `${JSON.stringify(incidents, null, 1)}\n`);
}
