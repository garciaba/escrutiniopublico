/**
 * Pre-publication sanity checks (specification, section 6). Pure functions: they
 * compare today's outputs with yesterday's, as committed in git, and say whether the
 * new data set may be published. Any failure keeps yesterday's data on the site.
 */

export interface SanityThresholds {
  activeDeputiesMin: number;
  activeDeputiesMax: number;
  maxRowLossPct: number;
  maxUnassignedPct: number;
  maxDailyScoreJump: number;
}

export type CheckState = 'ok' | 'fallo' | 'omitido';

export interface CheckResult {
  id: string;
  estado: CheckState;
  detalle: string;
}

/** The parts of meta.json and ranking.json the checks compare. */
export interface Snapshot {
  meta: {
    metodologia_version: string;
    legislatura: { finalizada: boolean };
    registros: Readonly<Record<string, number>>;
  };
  ranking: { filas: readonly { periodo: string; slug: string; nombre: string; indice: number | null }[] };
}

export interface AssignmentCount {
  tabla: string;
  total: number;
  /** Ids of the rows whose deputy is not in the census. */
  sinAsignar: readonly string[];
}

const pct = (part: number, total: number) => (total === 0 ? 0 : (100 * part) / total);
const fmt = (value: number) => value.toFixed(1).replace('.', ',');

/**
 * Between 340 and 350 deputies in office. Once the legislature is over only the
 * members of the Diputación Permanente stay in office, so the range does not apply.
 */
export function checkActiveDeputies(active: number, finalizada: boolean, t: SanityThresholds): CheckResult {
  const id = 'diputados_en_activo';
  if (finalizada) {
    return { id, estado: 'omitido', detalle: `Legislatura finalizada: ${active} diputados siguen en activo.` };
  }
  const ok = active >= t.activeDeputiesMin && active <= t.activeDeputiesMax;
  return {
    id,
    estado: ok ? 'ok' : 'fallo',
    detalle: `${active} diputados en activo (rango ${t.activeDeputiesMin}–${t.activeDeputiesMax}).`,
  };
}

/** No table loses more than the threshold of its rows from one day to the next. */
export function checkRowLoss(
  current: Readonly<Record<string, number>>,
  previous: Readonly<Record<string, number>> | undefined,
  t: SanityThresholds,
): CheckResult {
  const id = 'perdida_de_filas';
  if (!previous) return { id, estado: 'omitido', detalle: 'Sin datos del día anterior.' };
  const losses = Object.entries(previous)
    .map(([tabla, antes]) => ({ tabla, antes, ahora: current[tabla] ?? 0 }))
    .filter(({ antes, ahora }) => pct(antes - ahora, antes) > t.maxRowLossPct);
  if (losses.length === 0) return { id, estado: 'ok', detalle: `Ninguna tabla pierde más del ${t.maxRowLossPct} %.` };
  return {
    id,
    estado: 'fallo',
    detalle: losses
      .map(({ tabla, antes, ahora }) => `${tabla}: de ${antes} a ${ahora} filas (−${fmt(pct(antes - ahora, antes))} %)`)
      .join('; '),
  };
}

/** Rows whose deputy is not in the census: tolerated up to the threshold, always listed. */
export function checkAssignment(counts: readonly AssignmentCount[], t: SanityThresholds): CheckResult {
  const id = 'asignacion_a_diputados';
  const total = counts.reduce((sum, count) => sum + count.total, 0);
  const unassigned = counts.reduce((sum, count) => sum + count.sinAsignar.length, 0);
  const listed = counts
    .filter((count) => count.sinAsignar.length > 0)
    .map((count) => `${count.tabla}: ${count.sinAsignar.slice(0, 10).join(', ')}`)
    .join('; ');
  const share = pct(unassigned, total);
  return {
    id,
    estado: share <= t.maxUnassignedPct ? 'ok' : 'fallo',
    detalle:
      unassigned === 0
        ? `Las ${total} filas con diputado están asignadas a uno del censo.`
        : `${unassigned} de ${total} filas sin diputado del censo (${fmt(share)} %; límite ${t.maxUnassignedPct} %): ${listed}`,
  };
}

/**
 * No global index moves more than the threshold from one day to the next unless the
 * Chamber held new sessions. A new methodology version moves every score on purpose.
 */
export function checkScoreJumps(current: Snapshot, previous: Snapshot | undefined, t: SanityThresholds): CheckResult {
  const id = 'saltos_de_puntuacion';
  if (!previous) return { id, estado: 'omitido', detalle: 'Sin datos del día anterior.' };
  if (previous.meta.metodologia_version !== current.meta.metodologia_version) {
    return {
      id,
      estado: 'omitido',
      detalle: `Cambio de metodología: ${previous.meta.metodologia_version} → ${current.meta.metodologia_version}.`,
    };
  }
  const grew = (table: string) => (current.meta.registros[table] ?? 0) > (previous.meta.registros[table] ?? 0);
  if (grew('votaciones') || grew('intervenciones')) {
    return { id, estado: 'omitido', detalle: 'Hay sesiones nuevas: las puntuaciones pueden moverse.' };
  }
  const before = new Map(previous.ranking.filas.map((fila) => [`${fila.periodo}|${fila.slug}`, fila.indice]));
  const jumps = current.ranking.filas.flatMap((fila) => {
    const antes = before.get(`${fila.periodo}|${fila.slug}`);
    if (antes == null || fila.indice === null) return [];
    const delta = fila.indice - antes;
    return Math.abs(delta) > t.maxDailyScoreJump ? [`${fila.nombre} (${fila.periodo}): ${antes} → ${fila.indice}`] : [];
  });
  if (jumps.length === 0) {
    return {
      id,
      estado: 'ok',
      detalle: `Ningún índice varía más de ${t.maxDailyScoreJump} puntos sin sesiones nuevas.`,
    };
  }
  return {
    id,
    estado: 'fallo',
    detalle: `${jumps.length} índices varían más de ${t.maxDailyScoreJump} puntos sin sesiones nuevas: ${jumps.slice(0, 10).join('; ')}`,
  };
}
