/**
 * Normalize stage: validates every raw file against its schema, builds the tables of
 * section 5 of the specification (plus firmantes, D-016) and writes them, sorted by
 * key, to data/normalized/*.csv. Any failed check stops the stage.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { interventionOrganLabels } from '../../config/organos.ts';
import { nameAliases } from '../../config/overrides.ts';
import { project } from '../../config/project.ts';
import type { OrganComposition } from '../ingest/families/organos.ts';
import { loadVotesIndex, votesLegislatureDir } from '../ingest/families/votaciones.ts';
import { DAILY_DIR, writeAtomic } from '../ingest/raw-store.ts';
import { createNameResolver } from './names.ts';
import {
  billsFile,
  censusFile,
  interventionsFile,
  organMembersFile,
  parseOrThrow,
  searchDeputiesFile,
  searchInitiativesFile,
  voteFile,
  type SearchInitiativeRow,
} from './schemas.ts';
import { buildDiputados, buildGrupos, DIPUTADO_COLUMNS, GRUPO_COLUMNS } from './tables/diputados.ts';
import { buildIniciativas, FIRMANTE_COLUMNS, INICIATIVA_COLUMNS } from './tables/iniciativas.ts';
import { buildIntervenciones, INTERVENCION_COLUMNS } from './tables/intervenciones.ts';
import {
  buildOrganos,
  buildPertenencias,
  ORGANO_COLUMNS,
  PERTENENCIA_COLUMNS,
  specialRoles,
} from './tables/organos.ts';
import { buildVotaciones, VOTACION_COLUMNS, VOTO_COLUMNS, type Terms, type VoteSource } from './tables/votaciones.ts';
import { diputadoId, isoDate, toCsv, type CsvValue } from './util.ts';

export const NORMALIZED_DIR = join('data', 'normalized');

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function daily<T>(family: string, file: string, schema: Parameters<typeof parseOrThrow<T>>[0]): Promise<T> {
  const path = join(DAILY_DIR, family, file);
  return parseOrThrow(schema, await readJson(path), path);
}

async function loadVotes(): Promise<VoteSource[]> {
  const legislatura = project.legislatura.number;
  const dir = votesLegislatureDir(legislatura);
  const index = await loadVotesIndex(legislatura);
  const zipBySession = new Map(Object.values(index.dias).flatMap((sessions) => sessions.map((s) => [s.sesion, s.zip])));
  const sources: VoteSource[] = [];
  for (const sessionDir of (await readdir(dir, { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
    const sesion = Number(sessionDir.name.replace('Sesion', ''));
    for (const fileName of (await readdir(join(dir, sessionDir.name))).filter((name) => name.endsWith('.json'))) {
      const path = join(dir, sessionDir.name, fileName);
      const file = parseOrThrow(voteFile, await readJson(path), path);
      sources.push({
        legislatura,
        sesion,
        numero: file.informacion.numeroVotacion,
        zipUrl: zipBySession.get(sesion) ?? '',
        file,
      });
    }
  }
  return sources;
}

async function write<T extends Record<string, CsvValue>>(
  name: string,
  columns: readonly (keyof T & string)[],
  rows: readonly T[],
  keys: readonly (keyof T & string)[],
  log: (message: string) => void,
): Promise<void> {
  await writeAtomic(join(NORMALIZED_DIR, `${name}.csv`), toCsv(columns, rows, keys));
  log(`normalize: ${name}.csv ${rows.length} rows`);
}

export async function runNormalize(log: (message: string) => void): Promise<void> {
  const census = [
    ...(await daily('diputados', 'DiputadosActivos.json', censusFile)),
    ...(await daily('diputados', 'DiputadosDeBaja.json', censusFile)),
  ];
  const search = (await daily('diputados', 'busqueda.json', searchDeputiesFile)).data;
  const compositions = (await readJson(join(DAILY_DIR, 'organos', 'composicion.json'))) as OrganComposition[];
  for (const composition of compositions) parseOrThrow(organMembersFile, composition.miembros, composition.nombre);

  const legislatura = project.legislatura.number;
  const resolve = createNameResolver(
    census.map((row) => row.NOMBRE),
    nameAliases,
  );
  const idOf = (censusName: string) => diputadoId(legislatura, censusName);
  const terms: Terms = new Map(
    census.map((row) => [row.NOMBRE, { alta: isoDate(row.FECHAALTA) ?? '', baja: isoDate(row.FECHABAJA) }]),
  );

  const diputados = buildDiputados(census, search, specialRoles(compositions, resolve));
  await write('diputados', DIPUTADO_COLUMNS, diputados, ['diputado_id'], log);
  await write('grupos', GRUPO_COLUMNS, buildGrupos(diputados), ['grupo_id'], log);

  const organos = buildOrganos(compositions);
  await write('organos', ORGANO_COLUMNS, organos, ['organo_id'], log);
  const pertenencias = buildPertenencias(compositions, resolve, idOf);
  await write(
    'pertenencias',
    PERTENENCIA_COLUMNS,
    pertenencias,
    ['diputado_id', 'organo_id', 'fecha_inicio', 'cargo'],
    log,
  );

  const { votaciones, votos } = buildVotaciones(await loadVotes(), resolve, idOf, terms);
  await write('votaciones', VOTACION_COLUMNS, votaciones, ['votacion_id'], log);
  await write('votos', VOTO_COLUMNS, votos, ['votacion_id', 'diputado_id'], log);

  const organByName = new Map(organos.map((organo) => [organo.nombre, organo.organo_id]));
  const intervenciones = buildIntervenciones(
    await daily('intervenciones', 'IntervencionesCronologicamente.json', interventionsFile),
    resolve,
    idOf,
    terms,
    (label) => organByName.get(interventionOrganLabels[label] ?? label),
    (organoId) => organoId === 'diputacion-permanente',
  );
  await write('intervenciones', INTERVENCION_COLUMNS, intervenciones, ['intervencion_id'], log);

  const bills = [
    ...(await daily('iniciativas', 'ProyectosDeLey.json', billsFile)),
    ...(await daily('iniciativas', 'ProposicionesDeLey.json', billsFile)),
    ...(await daily('iniciativas', 'PropuestasDeReforma.json', billsFile)),
  ];
  const searchRows = new Map<string, SearchInitiativeRow[]>();
  for (const { codigo } of project.iniciativasBuscador.tipos) {
    searchRows.set(codigo, await daily('iniciativas', `buscador-${codigo}.json`, searchInitiativesFile));
  }
  const { iniciativas, firmantes, autoresNoDiputados } = buildIniciativas(bills, searchRows, resolve, idOf);
  // Authors that are not deputies of the Congreso (senators, groups): listed, never silently dropped.
  for (const [autor, veces] of [...autoresNoDiputados].sort(([a], [b]) => a.localeCompare(b, 'es'))) {
    log(`normalize: author that is not a deputy: ${autor} (${veces})`);
  }
  await write('iniciativas', INICIATIVA_COLUMNS, iniciativas, ['iniciativa_id'], log);
  await write('firmantes', FIRMANTE_COLUMNS, firmantes, ['iniciativa_id', 'orden'], log);
}
