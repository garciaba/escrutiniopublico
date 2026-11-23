/**
 * Message of the daily data commit (specification, section 6, step 7): what changed
 * in the official data since yesterday. Pure function; commits are written in English.
 */

export interface SummaryInput {
  fecha: string;
  metodologia: string;
  registros: Readonly<Record<string, number>>;
  /** votacion_id -> session number. */
  votaciones: ReadonlyMap<string, string>;
  /** diputado_id -> fecha_baja ('' while in office). */
  diputados: ReadonlyMap<string, string>;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function dailySummary(current: SummaryInput, previous: SummaryInput | undefined): string {
  if (!previous) return `Daily data update ${current.fecha}: first run\n`;
  const lines: string[] = [];

  const newVotes = [...current.votaciones.keys()].filter((id) => !previous.votaciones.has(id));
  const sessions = new Set(newVotes.map((id) => current.votaciones.get(id)));
  if (newVotes.length > 0) {
    lines.push(
      `${plural(sessions.size, 'new plenary session', 'new plenary sessions')} (${plural(newVotes.length, 'vote', 'votes')})`,
    );
  }

  const deltas = ['intervenciones', 'iniciativas', 'firmantes', 'ponentes', 'pertenencias'].flatMap((table) => {
    const delta = (current.registros[table] ?? 0) - (previous.registros[table] ?? 0);
    return delta === 0 ? [] : [`${table} ${delta > 0 ? '+' : ''}${delta}`];
  });
  if (deltas.length > 0) lines.push(`Rows: ${deltas.join(', ')}`);

  const joined = [...current.diputados.keys()].filter((id) => !previous.diputados.has(id));
  const left = [...current.diputados].filter(([id, baja]) => baja !== '' && previous.diputados.get(id) === '');
  if (joined.length > 0) lines.push(`${plural(joined.length, 'deputy joined', 'deputies joined')}`);
  if (left.length > 0) lines.push(`${plural(left.length, 'deputy left', 'deputies left')}`);

  if (current.metodologia !== previous.metodologia) {
    lines.push(`Methodology ${previous.metodologia} -> ${current.metodologia}`);
  }

  if (lines.length === 0) return `Daily data check ${current.fecha}: no changes in the official data\n`;
  const subject =
    newVotes.length > 0
      ? `Daily data update ${current.fecha}: ${plural(sessions.size, 'new session', 'new sessions')}`
      : `Daily data update ${current.fecha}`;
  return `${subject}\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`;
}
