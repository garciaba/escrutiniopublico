/**
 * Runs the sanity checks on the outputs of today's pipeline against yesterday's, as
 * committed in git (HEAD), and writes the message of the daily data commit.
 *
 *   pnpm sanity [--commit-message <file>]
 *
 * Exits with 1 when a check fails: nothing is committed or deployed.
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { project } from '../../config/project.ts';
import { DERIVED_DIR } from '../metrics/run-metrics.ts';
import { NORMALIZED_DIR } from '../normalize/run-normalize.ts';
import { parseCsv } from '../normalize/util.ts';
import {
  checkActiveDeputies,
  checkAssignment,
  checkRowLoss,
  checkScoreJumps,
  type AssignmentCount,
  type CheckResult,
  type Snapshot,
} from './checks.ts';
import { dailySummary, type SummaryInput } from './summary.ts';

const { values: args } = parseArgs({ options: { 'commit-message': { type: 'string' } } });

/** File content at HEAD, or undefined on the first run. */
function committed(path: string): string | undefined {
  try {
    return execFileSync('git', ['show', `HEAD:${path}`], {
      encoding: 'utf-8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return undefined;
  }
}

const csvPath = (table: string) => join(NORMALIZED_DIR, `${table}.csv`);
const read = (path: string) => readFile(path, 'utf-8');

type MetaJson = Snapshot['meta'] & { fecha_calculo: string };

function summaryInput(meta: MetaJson, votaciones: string, diputados: string): SummaryInput {
  return {
    fecha: meta.fecha_calculo,
    metodologia: meta.metodologia_version,
    registros: meta.registros,
    votaciones: new Map(parseCsv(votaciones).map((row) => [row.votacion_id ?? '', row.sesion ?? ''])),
    diputados: new Map(parseCsv(diputados).map((row) => [row.diputado_id ?? '', row.fecha_baja ?? ''])),
  };
}

const meta = JSON.parse(await read(join(DERIVED_DIR, 'meta.json'))) as MetaJson;
const ranking = JSON.parse(await read(join(DERIVED_DIR, 'ranking.json'))) as Snapshot['ranking'];
const previousMetaText = committed(`${DERIVED_DIR}/meta.json`);
const previousRankingText = committed(`${DERIVED_DIR}/ranking.json`);
const previous: Snapshot | undefined =
  previousMetaText && previousRankingText
    ? {
        meta: JSON.parse(previousMetaText) as MetaJson,
        ranking: JSON.parse(previousRankingText) as Snapshot['ranking'],
      }
    : undefined;

const diputadosText = await read(csvPath('diputados'));
const diputados = parseCsv(diputadosText);
const census = new Set(diputados.map((row) => row.diputado_id));
const active = diputados.filter((row) => !row.fecha_baja).length;

const assignment: AssignmentCount[] = [];
for (const [tabla, key] of [
  ['votos', 'votacion_id'],
  ['intervenciones', 'intervencion_id'],
  ['firmantes', 'iniciativa_id'],
  ['ponentes', 'iniciativa_id'],
  ['pertenencias', 'organo_id'],
] as const) {
  const rows = parseCsv(await read(csvPath(tabla)));
  assignment.push({
    tabla,
    total: rows.length,
    sinAsignar: rows.filter((row) => !census.has(row.diputado_id)).map((row) => row[key] ?? '?'),
  });
}

const t = project.sanity;
const results: CheckResult[] = [
  checkActiveDeputies(active, meta.legislatura.finalizada, t),
  checkRowLoss(meta.registros, previous?.meta.registros, t),
  checkAssignment(assignment, t),
  checkScoreJumps({ meta, ranking }, previous, t),
];
for (const result of results) console.log(`sanity: ${result.estado.padEnd(7)} ${result.id}: ${result.detalle}`);

if (args['commit-message']) {
  const previousVotaciones = committed(`${NORMALIZED_DIR}/votaciones.csv`);
  const previousDiputados = committed(`${NORMALIZED_DIR}/diputados.csv`);
  const message = dailySummary(
    summaryInput(meta, await read(csvPath('votaciones')), diputadosText),
    previous && previousVotaciones && previousDiputados
      ? summaryInput(previous.meta as MetaJson, previousVotaciones, previousDiputados)
      : undefined,
  );
  await writeFile(args['commit-message'], message);
  console.log(`sanity: commit message written to ${args['commit-message']}`);
}

if (results.some((result) => result.estado === 'fallo')) {
  console.error('sanity: at least one check failed; nothing will be published');
  process.exit(1);
}
