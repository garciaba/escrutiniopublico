/**
 * Deputies' agendas (decision D-017). The Congreso publishes, per deputy and week,
 * an institutional agenda generated from the sessions of the bodies they belong to
 * and, if the deputy opts in, a personal agenda typed by hand. Personal entries can
 * name third parties, so Escrutinio Público never stores their text: only date, times and type.
 */

/** Entry as returned by the `agendaDiputados` resource. */
export interface RawAgendaEntry {
  fechaAgenda: string;
  agendaCodOrgAbr: string;
  horaAgenda1: string;
  horaAgenda2: string;
  textoAgenda: string;
}

export interface RawAgendaWeek {
  tieneAgenda?: boolean;
  fechaInicio?: string;
  fechaFin?: string;
  agendasDiputado?: RawAgendaEntry[];
}

export type AgendaEntryType = 'institucional' | 'personal';

/** What is stored and published. Personal entries carry no free text at all. */
export interface AgendaEntry {
  /** yyyy-mm-dd */
  fecha: string;
  /** hh:mm, when given. */
  horaInicio?: string;
  horaFin?: string;
  tipo: AgendaEntryType;
  /** Official body name, only for institutional entries. */
  organo?: string;
}

/** "2001-01-01T15:00:00.000+01:00" -> "15:00"; anything else -> undefined. */
export function parseAgendaTime(value: string): string | undefined {
  const match = /T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : undefined;
}

/**
 * Classifies and strips an entry. An entry is institutional only when its label is
 * exactly the name of an official body; anything else is treated as personal and
 * its text is dropped. Unknown labels therefore never leak text into the dataset.
 */
export function sanitizeAgendaEntry(raw: RawAgendaEntry, officialBodies: ReadonlySet<string>): AgendaEntry {
  const label = raw.agendaCodOrgAbr.replace(/\s+/g, ' ').trim();
  const institutional = officialBodies.has(label) && raw.textoAgenda.trim() === '';
  const entry: AgendaEntry = {
    fecha: raw.fechaAgenda.slice(0, 10),
    tipo: institutional ? 'institucional' : 'personal',
  };
  const start = parseAgendaTime(raw.horaAgenda1);
  const end = parseAgendaTime(raw.horaAgenda2);
  if (start) entry.horaInicio = start;
  if (end) entry.horaFin = end;
  if (institutional) entry.organo = label;
  return entry;
}

/** Stable order so that daily diffs only show real changes. */
export function sortAgendaEntries(entries: readonly AgendaEntry[]): AgendaEntry[] {
  const key = (entry: AgendaEntry) =>
    [entry.fecha, entry.horaInicio ?? '', entry.tipo, entry.organo ?? '', entry.horaFin ?? ''].join('|');
  return [...entries].sort((a, b) => key(a).localeCompare(key(b)));
}

/** Mondays (yyyy-mm-dd) of every week that overlaps [from, to], both yyyy-mm-dd. */
export function weekMondays(from: string, to: string): string[] {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
  const mondays: string[] = [];
  for (const cursor = start; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
    mondays.push(cursor.toISOString().slice(0, 10));
  }
  return mondays;
}

/** yyyy-mm-dd -> dd/mm/yyyy, the format the agenda resource expects. */
export function toSpanishDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}
