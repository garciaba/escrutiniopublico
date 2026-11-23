/**
 * Captures the agendas of the deputies currently in office (decision D-017) into
 * data/raw/agendas/<legislature>/<codParlamentario>.json, one request per deputy
 * and week at the polite rate of config/project.ts. Only sanitized entries are
 * written (pipeline/ingest/agendas.ts): personal entries keep no text.
 *
 * Resumable: a deputy whose file already covers the requested range is skipped,
 * and the run stops cleanly before --deadline-minutes so it fits in a CI job.
 *
 * Usage: node pipeline/ingest/capture-agendas.ts [--to yyyy-mm-dd] [--deadline-minutes n] [--only cod,cod]
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { agendaOfficialBodies } from '../../config/agenda.ts';
import { project } from '../../config/project.ts';
import { decodeText } from '../discover/profile.ts';
import {
  sanitizeAgendaEntry,
  sortAgendaEntries,
  toSpanishDate,
  weekMondays,
  type AgendaEntry,
  type RawAgendaWeek,
} from './agendas.ts';
import { PoliteClient } from './http.ts';

interface SearchDeputy {
  apellidosNombre: string;
  codParlamentario: number;
  fchBaja: string;
}

interface AgendaFile {
  legislatura: string;
  codParlamentario: number;
  nombre: string;
  desde: string;
  hasta: string;
  semanasConsultadas: number;
  capturado: string;
  fuente: string;
  entradas: AgendaEntry[];
}

const { values: args } = parseArgs({
  options: {
    to: { type: 'string' },
    'deadline-minutes': { type: 'string', default: '330' },
    only: { type: 'string' },
  },
});

const { legislatura, baseUrl } = project;
const from = project.agendas.legislatureStart;
const to = args.to ?? new Date().toISOString().slice(0, 10);
const deadline = Date.now() + Number(args['deadline-minutes']) * 60_000;
const only = args.only ? new Set(args.only.split(',').map(Number)) : undefined;
const outDir = join('data', 'raw', 'agendas', legislatura.roman);
const client = new PoliteClient(project.http);
const bodies = new Set(agendaOfficialBodies);

function resourceUrl(query: Record<string, string>): string {
  const url = new URL(project.agendas.path, baseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

async function currentDeputies(): Promise<SearchDeputy[]> {
  const response = await client.postForm(resourceUrl(project.agendas.searchQuery), {
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
  const parsed = JSON.parse(decodeText(response.body)) as { data?: SearchDeputy[] };
  return (parsed.data ?? []).filter((deputy) => deputy.fchBaja === '');
}

async function fetchWeek(cod: number, monday: string): Promise<RawAgendaWeek> {
  const response = await client.postForm(
    resourceUrl({
      ...project.agendas.agendaQuery,
      _diputadomodule_idLegislatura: legislatura.roman,
      _diputadomodule_codParlamentario: String(cod),
    }),
    {
      _diputadomodule_codParlamentario: String(cod),
      _diputadomodule_idLegInt: String(legislatura.number),
      _diputadomodule_fechaSeleccionada: toSpanishDate(monday),
    },
  );
  return JSON.parse(decodeText(response.body)) as RawAgendaWeek;
}

async function alreadyCovered(file: string): Promise<boolean> {
  try {
    const existing = JSON.parse(await readFile(file, 'utf-8')) as AgendaFile;
    return existing.desde <= from && existing.hasta >= to;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const deputies = (await currentDeputies()).filter((deputy) => !only || only.has(deputy.codParlamentario));
  const mondays = weekMondays(from, to);
  console.log(`${deputies.length} deputies in office, ${mondays.length} weeks from ${from} to ${to}`);
  let done = 0;
  let skipped = 0;
  for (const deputy of deputies) {
    const file = join(outDir, `${deputy.codParlamentario}.json`);
    if (await alreadyCovered(file)) {
      skipped++;
      continue;
    }
    // Estimate: one request per week at the configured interval, plus a margin.
    if (Date.now() + mondays.length * (project.http.minIntervalMs + 500) > deadline) {
      console.log('Stopping before the deadline; run again to continue.');
      break;
    }
    const entries: AgendaEntry[] = [];
    let unavailable = false;
    for (const monday of mondays) {
      const week = await fetchWeek(deputy.codParlamentario, monday);
      if (week.tieneAgenda === false) {
        unavailable = true;
        break;
      }
      for (const raw of week.agendasDiputado ?? []) {
        if (raw.fechaAgenda.slice(0, 10) >= from && raw.fechaAgenda.slice(0, 10) <= to) {
          entries.push(sanitizeAgendaEntry(raw, bodies));
        }
      }
    }
    if (unavailable) {
      console.log(`${deputy.codParlamentario} ${deputy.apellidosNombre}: agenda no longer available`);
      continue;
    }
    const unique = new Map(entries.map((entry) => [JSON.stringify(entry), entry]));
    const content: AgendaFile = {
      legislatura: legislatura.roman,
      codParlamentario: deputy.codParlamentario,
      nombre: deputy.apellidosNombre,
      desde: from,
      hasta: to,
      semanasConsultadas: mondays.length,
      capturado: new Date().toISOString(),
      fuente: 'Congreso de los Diputados, agenda del diputado (recurso agendaDiputados)',
      entradas: sortAgendaEntries([...unique.values()]),
    };
    await writeFile(`${file}.tmp`, `${JSON.stringify(content, null, 1)}\n`);
    await rename(`${file}.tmp`, file);
    done++;
    const personal = content.entradas.filter((entry) => entry.tipo === 'personal').length;
    console.log(
      `${deputy.codParlamentario} ${deputy.apellidosNombre}: ${content.entradas.length} entries (${personal} personal)`,
    );
  }
  console.log(`Captured ${done}, already complete ${skipped}, of ${deputies.length}.`);
}

await main();
