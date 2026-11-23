/**
 * Metrics stage: reads data/normalized/*.csv, runs the pure scoring engine for the
 * calculation date and writes data/derived/ (ranking.json, diputados/<slug>.json and
 * meta.json). Works on a clean clone: it only needs versioned files.
 */
import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { governmentMembers } from '../../config/overrides.ts';
import { project } from '../../config/project.ts';
import { scoring } from '../../config/scoring.ts';
import { loadManifest, RAW_DIR, writeAtomic } from '../ingest/raw-store.ts';
import { NORMALIZED_DIR } from '../normalize/run-normalize.ts';
import { parseCsv } from '../normalize/util.ts';
import {
  buildFichas,
  buildMeta,
  buildRanking,
  serializeRanking,
  type DeriveInput,
  type GobiernoFull,
} from './derive.ts';
import { buildIndex, computePeriod, type Tables } from './engine.ts';

export const DERIVED_DIR = join('data', 'derived');

async function table(name: string): Promise<Record<string, string>[]> {
  return parseCsv(await readFile(join(NORMALIZED_DIR, `${name}.csv`), 'utf-8'));
}

const optional = (value: string | undefined): string | undefined => (value ? value : undefined);
const text = (row: Record<string, string>, column: string): string => {
  const value = row[column];
  if (value === undefined) throw new Error(`Column ${column} missing in a normalized table`);
  return value;
};

/** "…/DiputadosActivos__20261123050006.json" -> "2026-11-23" */
function fileDate(url: string): string | null {
  const match = /__(\d{4})(\d{2})(\d{2})\d{6}\./.exec(url);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export interface MetricsOptions {
  fechaCalculo: string;
  ejecutado: string;
  commit: string | null;
}

export async function runMetrics(options: MetricsOptions, log: (message: string) => void): Promise<void> {
  const [
    diputadosRaw,
    gruposRaw,
    organosRaw,
    pertenenciasRaw,
    votacionesRaw,
    votosRaw,
    intervencionesRaw,
    iniciativasRaw,
    firmantesRaw,
    ponentesRaw,
  ] = await Promise.all(
    [
      'diputados',
      'grupos',
      'organos',
      'pertenencias',
      'votaciones',
      'votos',
      'intervenciones',
      'iniciativas',
      'firmantes',
      'ponentes',
    ].map(table),
  );
  const rows = (list: Record<string, string>[] | undefined) => list ?? [];

  const diputados = rows(diputadosRaw).map((row) => ({
    diputado_id: text(row, 'diputado_id'),
    nombre_completo: text(row, 'nombre_completo'),
    grupo_id: text(row, 'grupo_id'),
    fecha_alta: text(row, 'fecha_alta'),
    fecha_baja: optional(row.fecha_baja),
    cod_parlamentario: Number(text(row, 'cod_parlamentario')),
    nombre: text(row, 'nombre'),
    apellidos: text(row, 'apellidos'),
    slug: text(row, 'slug'),
    formacion: text(row, 'formacion'),
    partido: text(row, 'partido'),
    circunscripcion: text(row, 'circunscripcion'),
    url_ficha_oficial: text(row, 'url_ficha_oficial'),
  }));
  const idByName = new Map(diputados.map((diputado) => [diputado.nombre_completo, diputado.diputado_id]));
  const gobierno: GobiernoFull[] = governmentMembers.map((term) => {
    const id = idByName.get(term.name);
    if (!id) throw new Error(`Government member not in the diputados table: ${term.name}`);
    return { diputado_id: id, from: term.from, until: term.until, posts: term.posts, evidence: term.evidence };
  });
  const votaciones = rows(votacionesRaw)
    .filter((row) => row.nominal === 'true')
    .map((row) => ({
      votacion_id: text(row, 'votacion_id'),
      fecha: text(row, 'fecha'),
      titulo: text(row, 'titulo'),
      texto_expediente: text(row, 'texto_expediente'),
      url_fuente: text(row, 'url_fuente'),
    }));
  const votos = rows(votosRaw).map((row) => ({
    votacion_id: text(row, 'votacion_id'),
    diputado_id: text(row, 'diputado_id'),
    sentido: text(row, 'sentido'),
    grupo_id: text(row, 'grupo_id'),
    telematico: row.telematico === 'true',
  }));
  const intervenciones = rows(intervencionesRaw).map((row) => ({
    intervencion_id: text(row, 'intervencion_id'),
    fecha: text(row, 'fecha'),
    organo_id: text(row, 'organo_id'),
    diputado_id: text(row, 'diputado_id'),
    cuenta: row.cuenta === 'true',
    hora_inicio: optional(row.hora_inicio),
    hora_fin: optional(row.hora_fin),
    tipo_iniciativa: optional(row.tipo_iniciativa),
    motivo_exclusion: optional(row.motivo_exclusion),
    url_fuente: optional(row.url_fuente),
    url_video: text(row, 'url_video'),
  }));
  const organos = rows(organosRaw).map((row) => ({
    organo_id: text(row, 'organo_id'),
    tipo: text(row, 'tipo'),
    nombre: text(row, 'nombre'),
  }));
  const pertenencias = rows(pertenenciasRaw).map((row) => ({
    diputado_id: text(row, 'diputado_id'),
    organo_id: text(row, 'organo_id'),
    cargo: text(row, 'cargo'),
    fecha_inicio: text(row, 'fecha_inicio'),
    fecha_fin: optional(row.fecha_fin),
  }));
  const tables: Tables = {
    diputados,
    votaciones,
    votos,
    intervenciones,
    organos,
    iniciativas: rows(iniciativasRaw).map((row) => ({
      iniciativa_id: text(row, 'iniciativa_id'),
      tipo_codigo: text(row, 'tipo_codigo'),
      fecha_presentacion: optional(row.fecha_presentacion),
      resultado: optional(row.resultado),
      fecha_resultado: optional(row.fecha_resultado),
      fecha_conclusion: optional(row.fecha_conclusion),
    })),
    firmantes: rows(firmantesRaw).map((row) => ({
      iniciativa_id: text(row, 'iniciativa_id'),
      diputado_id: text(row, 'diputado_id'),
      orden: Number(text(row, 'orden')),
      n_firmantes: Number(text(row, 'n_firmantes')),
    })),
    ponentes: rows(ponentesRaw).map((row) => ({
      iniciativa_id: text(row, 'iniciativa_id'),
      diputado_id: text(row, 'diputado_id'),
    })),
    pertenencias,
    gobierno,
  };

  const { legislatura } = project;
  const index = buildIndex(tables);
  const periods = scoring.periodos.map((period) =>
    computePeriod(tables, index, scoring, legislatura, period, options.fechaCalculo),
  );
  for (const period of periods) {
    log(
      `metrics: ${period.id}: ${period.estado}${period.motivo ? ` (${period.motivo})` : ''}` +
        (period.estado === 'disponible'
          ? `, ${period.desde}..${period.hasta}, referencia ${period.poblacion_referencia}, cobertura ${period.cobertura}`
          : ''),
    );
  }

  const manifest = await loadManifest();
  const daily = Object.entries(manifest).filter(([key]) => !key.startsWith('votaciones/'));
  const lastVote = votaciones.reduce((latest, row) => (row.fecha > latest ? row.fecha : latest), '');
  const dateOf = (key: string): string | undefined => {
    const entry = manifest[key];
    return entry ? (fileDate(entry.url) ?? entry.descargado) : undefined;
  };
  const fechasFuente: Record<string, string> = {};
  if (lastVote) fechasFuente.votaciones = lastVote;
  const speechesDate = dateOf('intervenciones/IntervencionesCronologicamente');
  if (speechesDate) fechasFuente.intervenciones = speechesDate;
  const initiativesDate = dateOf(`iniciativas/buscador-${project.iniciativasBuscador.tipos[0].codigo}`);
  if (initiativesDate) fechasFuente.iniciativas = initiativesDate;
  const billsDate = dateOf('iniciativas/ProyectosDeLey');
  if (billsDate) fechasFuente.leyes = billsDate;

  // Bills with a ponencia, for the list of each profile.
  const ponentesPorLey = new Map<string, string[]>();
  for (const ponente of tables.ponentes) {
    ponentesPorLey.set(ponente.iniciativa_id, [
      ...(ponentesPorLey.get(ponente.iniciativa_id) ?? []),
      ponente.diputado_id,
    ]);
  }
  const leyes = rows(iniciativasRaw)
    .filter((row) => ponentesPorLey.has(text(row, 'iniciativa_id')))
    .map((row) => ({
      iniciativa_id: text(row, 'iniciativa_id'),
      tipo: text(row, 'tipo'),
      titulo: text(row, 'titulo'),
      resultado: optional(row.resultado),
      fecha_resultado: optional(row.fecha_conclusion) ?? optional(row.fecha_resultado),
      url_fuente: text(row, 'url_fuente'),
      ponentes: ponentesPorLey.get(text(row, 'iniciativa_id')) ?? [],
    }));

  const input: DeriveInput = {
    scoring,
    legislatura,
    fechaCalculo: options.fechaCalculo,
    periods,
    index,
    diputados,
    grupos: rows(gruposRaw).map((row) => ({
      grupo_id: text(row, 'grupo_id'),
      nombre: text(row, 'nombre'),
      nombre_corto: text(row, 'nombre_corto'),
    })),
    organos,
    pertenencias,
    votaciones,
    votos,
    intervenciones,
    gobierno,
    leyes,
    fechasFuente,
    limites: project.ficha,
  };

  await writeAtomic(join(DERIVED_DIR, 'ranking.json'), serializeRanking(buildRanking(input)));
  const fichas = buildFichas(input);
  const fichasDir = join(DERIVED_DIR, 'diputados');
  for (const [slug, ficha] of fichas) {
    await writeAtomic(join(fichasDir, `${slug}.json`), `${JSON.stringify(ficha, null, 1)}\n`);
  }
  for (const file of await readdir(fichasDir)) {
    if (file.endsWith('.json') && !fichas.has(file.slice(0, -5))) await rm(join(fichasDir, file));
  }

  let incidencias: unknown[] = [];
  try {
    incidencias = JSON.parse(await readFile(join(RAW_DIR, 'iniciativas-incidencias.json'), 'utf-8')) as unknown[];
  } catch {
    // No incident file: nothing to report.
  }
  const meta = buildMeta(input, {
    ejecutado: options.ejecutado,
    commit: options.commit,
    fuentes: daily.map(([id, entry]) => ({
      id,
      url: entry.url,
      descargado: entry.descargado,
      fecha_fichero: fileDate(entry.url),
    })),
    registros: {
      diputados: diputados.length,
      grupos: rows(gruposRaw).length,
      organos: organos.length,
      pertenencias: pertenencias.length,
      votaciones: rows(votacionesRaw).length,
      votos: votos.length,
      intervenciones: intervenciones.length,
      iniciativas: tables.iniciativas.length,
      firmantes: tables.firmantes.length,
      ponentes: tables.ponentes.length,
    },
    incidencias,
  });
  await writeAtomic(join(DERIVED_DIR, 'meta.json'), `${JSON.stringify(meta, null, 1)}\n`);
  log(`metrics: ranking.json, ${fichas.size} profiles and meta.json written`);
}
