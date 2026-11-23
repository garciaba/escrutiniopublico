/**
 * Milestone 0 discovery run. Downloads the current file of every configured dataset,
 * the most recent voting sessions and one committee composition export, profiles
 * them and writes a report. It exits with an error if any family cannot be reached,
 * which is how the GitHub Actions workflow checks that downloads work from CI.
 *
 * Usage: pnpm discover [--out <dir>] [--days <n>]
 */
import { createHash } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { unzipSync } from 'fflate';

import { project } from '../../config/project.ts';
import { PoliteClient } from '../ingest/http.ts';
import {
  extractDownloadLinks,
  extractSessionZips,
  extractVotingDays,
  pickDatasetLink,
  votingDayUrl,
} from '../ingest/index-page.ts';
import { decodeText, profileRecords, type DatasetProfile } from './profile.ts';

interface Check {
  family: string;
  item: string;
  url: string;
  ok: boolean;
  status?: number;
  bytes?: number;
  sha256?: string;
  rows?: number;
  note?: string;
  error?: string;
  profile?: DatasetProfile;
}

const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: '.discovery' },
    days: { type: 'string', default: '2' },
  },
});
const outDir = args.out;
const parsedDays = Number.parseInt(args.days, 10);
/** Falls back to 2 on invalid input, so a typo never triggers a full-legislature download. */
const votingDaysToSample = Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : 2;

const client = new PoliteClient(project.http);
const checks: Check[] = [];
/** Index page HTML by family, fetched once per run. */
const indexHtml = new Map<string, string>();

function absolute(path: string): string {
  return new URL(path, project.baseUrl).toString();
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function save(family: string, fileName: string, bytes: Uint8Array): Promise<void> {
  const dir = join(outDir, 'raw', family);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName), bytes);
}

function parseJsonArray(bytes: Uint8Array): unknown[] {
  const parsed: unknown = JSON.parse(decodeText(bytes));
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array');
  return parsed;
}

async function discoverStaticDatasets(): Promise<void> {
  for (const [family, path] of Object.entries(project.indexPages)) {
    const url = absolute(path);
    try {
      const response = await client.get(url);
      indexHtml.set(family, decodeText(response.body));
      checks.push({ family, item: 'index page', url, ok: true, status: response.status });
    } catch (error) {
      checks.push({ family, item: 'index page', url, ok: false, error: errorMessage(error) });
    }
  }

  for (const dataset of project.datasets) {
    const html = indexHtml.get(dataset.family);
    const indexUrl = absolute(project.indexPages[dataset.family]);
    if (html === undefined) continue;
    const link = pickDatasetLink(extractDownloadLinks(html, project.baseUrl), dataset.prefix, project.formatPreference);
    if (!link) {
      checks.push({
        family: dataset.family,
        item: dataset.id,
        url: indexUrl,
        ok: false,
        error: `No link with prefix ${dataset.prefix} on the index page`,
      });
      continue;
    }
    try {
      const response = await client.get(link.url);
      await save(dataset.family, link.fileName, response.body);
      const records = link.format === 'json' ? parseJsonArray(response.body) : [];
      checks.push({
        family: dataset.family,
        item: dataset.id,
        url: link.url,
        ok: true,
        status: response.status,
        bytes: response.body.byteLength,
        sha256: sha256(response.body),
        rows: records.length,
        note: `format ${link.format}, generated ${link.timestamp}`,
        profile: profileRecords(records),
      });
    } catch (error) {
      checks.push({
        family: dataset.family,
        item: dataset.id,
        url: link.url,
        ok: false,
        error: errorMessage(error),
      });
    }
  }
}

async function discoverVotaciones(): Promise<void> {
  const indexUrl = absolute(project.indexPages.votaciones);
  const html = indexHtml.get('votaciones');
  if (html === undefined) return;
  const days = extractVotingDays(html);
  checks.push({
    family: 'votaciones',
    item: 'voting days',
    url: indexUrl,
    ok: days.length > 0,
    rows: days.length,
    note: days.length > 0 ? `${days[0]} to ${days.at(-1)}` : 'diasVotaciones not found',
  });

  for (const day of days.slice(-votingDaysToSample)) {
    const dayUrl = votingDayUrl(
      project.baseUrl,
      project.votaciones.dayPagePath,
      project.votaciones.dayPageQuery,
      project.legislatura.roman,
      day,
    );
    try {
      const zips = extractSessionZips(decodeText((await client.get(dayUrl)).body), project.baseUrl);
      if (zips.length === 0) throw new Error('No session ZIP linked on the day page');
      for (const zip of zips) {
        const response = await client.get(zip.url);
        await save('votaciones', `Leg${zip.legislatura}_Sesion${zip.sesion}_${zip.fileName}`, response.body);
        const entries = unzipSync(response.body);
        const names = Object.keys(entries);
        const byExtension: Record<string, number> = {};
        for (const name of names) {
          const extension = name.split('.').pop() ?? '';
          byExtension[extension] = (byExtension[extension] ?? 0) + 1;
        }
        const firstJson = names.filter((name) => name.endsWith('.json')).sort()[0];
        let profile: DatasetProfile | undefined;
        if (firstJson) {
          const entry = entries[firstJson];
          const vote: unknown = entry ? JSON.parse(decodeText(entry)) : undefined;
          const rows =
            vote && typeof vote === 'object' && 'votaciones' in vote && Array.isArray(vote.votaciones)
              ? (vote.votaciones as unknown[])
              : [];
          profile = profileRecords(rows);
        }
        checks.push({
          family: 'votaciones',
          item: `session ${zip.sesion} (${zip.fecha})`,
          url: zip.url,
          ok: true,
          status: response.status,
          bytes: response.body.byteLength,
          sha256: sha256(response.body),
          note: `files in ZIP: ${JSON.stringify(byExtension)}${firstJson ? '' : ' — no JSON (no nominal data)'}`,
          ...(profile ? { profile, rows: profile.rows } : {}),
        });
      }
    } catch (error) {
      checks.push({ family: 'votaciones', item: `day ${day}`, url: dayUrl, ok: false, error: errorMessage(error) });
    }
  }
}

function withQuery(path: string, query: Readonly<Record<string, string>>): string {
  const url = new URL(path, project.baseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

async function discoverOrganos(): Promise<void> {
  const { organos, legislatura } = project;
  const listUrl = withQuery(organos.listPath, organos.listQuery);
  let suborgano: string | undefined;
  try {
    const response = await client.postForm(listUrl, {
      _opendata_tipoConsulta: '3',
      _opendata_legislatura: String(legislatura.number),
    });
    const parsed = JSON.parse(decodeText(response.body)) as {
      datosOrganos?: { urlExport?: string; descOrgano?: string }[];
    };
    const committees = parsed.datosOrganos ?? [];
    const first = committees[0];
    suborgano = first?.urlExport
      ? (new URL(first.urlExport, project.baseUrl).searchParams.get('_organos_selectedSuborgano') ?? undefined)
      : undefined;
    checks.push({
      family: 'organos',
      item: 'committee list',
      url: listUrl,
      ok: committees.length > 0,
      status: response.status,
      rows: committees.length,
      note: first ? `first: ${first.descOrgano ?? '?'} (suborgano ${suborgano ?? '?'})` : 'empty list',
    });
  } catch (error) {
    checks.push({ family: 'organos', item: 'committee list', url: listUrl, ok: false, error: errorMessage(error) });
  }

  const exports: { item: string; path: string; organoSup: number; suborgano: string }[] = [
    { item: 'Mesa composition export', ...organos.superiores.mesa, suborgano: '' },
    {
      item: 'Diputación Permanente composition export',
      ...organos.superiores.diputacionPermanente,
      suborgano: '',
    },
  ];
  if (suborgano) {
    exports.push({
      item: `committee ${suborgano} composition export`,
      path: organos.exportPath,
      organoSup: organos.comisionesOrganoSup,
      suborgano,
    });
  }
  for (const target of exports) {
    const exportUrl = withQuery(target.path, {
      ...organos.exportQuery,
      _organos_selectedLegislatura: legislatura.roman,
      _organos_statusOpenData: 'true',
      _organos_selectedOrganoSup: String(target.organoSup),
      _organos_selectedSuborgano: target.suborgano,
    });
    try {
      const response = await client.postForm(exportUrl, {
        _organos_selectedLegislatura: legislatura.roman,
        _organos_compoHistorica: 'true',
        _organos_selectedOrganoSup: String(target.organoSup),
        _organos_selectedSuborgano: target.suborgano,
        _organos_fileType: 'json',
      });
      const records = parseJsonArray(response.body);
      const fileName = `organo_${target.organoSup}_${target.suborgano || 'all'}.json`;
      await save('organos', fileName, response.body);
      checks.push({
        family: 'organos',
        item: target.item,
        url: exportUrl,
        ok: records.length > 0,
        status: response.status,
        bytes: response.body.byteLength,
        sha256: sha256(response.body),
        rows: records.length,
        note: response.headers.get('content-disposition') ?? '',
        profile: profileRecords(records),
      });
    } catch (error) {
      checks.push({ family: 'organos', item: target.item, url: exportUrl, ok: false, error: errorMessage(error) });
    }
  }
}

function renderMarkdown(startedAt: string): string {
  const lines = [
    `# Discovery report`,
    '',
    `Run started ${startedAt} with User-Agent \`${project.http.userAgent}\`.`,
    '',
    '| Family | Item | OK | HTTP | Bytes | Rows | Note |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const check of checks) {
    lines.push(
      `| ${check.family} | ${check.item} | ${check.ok ? 'yes' : '**NO**'} | ${check.status ?? ''} | ${check.bytes ?? ''} | ${check.rows ?? ''} | ${(check.error ?? check.note ?? '').replace(/\|/g, '/')} |`,
    );
  }
  for (const check of checks.filter((c) => c.profile && c.profile.fields.length > 0)) {
    lines.push(
      '',
      `## ${check.family} · ${check.item}`,
      '',
      '| Field | Present | Non-empty | Distinct | Example |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const field of check.profile?.fields ?? []) {
      lines.push(
        `| ${field.field} | ${field.present} | ${field.nonEmpty} | ${field.distinct} | ${(field.examples[0] ?? '').replace(/\|/g, '/')} |`,
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  await mkdir(outDir, { recursive: true });
  await discoverStaticDatasets();
  await discoverVotaciones();
  await discoverOrganos();

  const markdown = renderMarkdown(startedAt);
  await writeFile(join(outDir, 'report.json'), `${JSON.stringify({ startedAt, checks }, null, 2)}\n`);
  await writeFile(join(outDir, 'report.md'), markdown);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    console.log(`${check.ok ? 'ok  ' : 'FAIL'} ${check.family} · ${check.item} ${check.error ?? check.note ?? ''}`);
  }
  console.log(
    `\n${checks.length - failed.length}/${checks.length} checks passed. Report: ${join(outDir, 'report.md')}`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

await main();
