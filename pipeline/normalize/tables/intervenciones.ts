/**
 * intervenciones table (decisions D-009, D-013 and D-033). One row per distinct speech
 * (ENLACEDIFERIDO) given by a census deputy; joint debates that repeat the same speech
 * for several initiatives are merged. `cuenta` says whether the speech counts as
 * the deputy's parliamentary activity, and `motivo_exclusion` why not.
 */
import { groups } from '../../../config/parties.ts';
import { governmentMembers, notDeputies } from '../../../config/overrides.ts';
import { splitSpeaker } from '../names.ts';
import type { InterventionRow } from '../schemas.ts';
import { clean, isoDate } from '../util.ts';
import type { Terms } from './votaciones.ts';

export interface IntervencionRow extends Record<string, string | boolean | undefined> {
  intervencion_id: string;
  fecha: string;
  organo_id: string;
  diputado_id: string;
  cargo_orador: string;
  clase_cargo: CargoClass;
  fase: string | undefined;
  tipo_iniciativa: string | undefined;
  expedientes: string | undefined;
  hora_inicio: string | undefined;
  hora_fin: string | undefined;
  cuenta: boolean;
  motivo_exclusion: string | undefined;
  url_fuente: string | undefined;
  url_video: string;
}

export const INTERVENCION_COLUMNS = [
  'intervencion_id',
  'fecha',
  'organo_id',
  'diputado_id',
  'cargo_orador',
  'clase_cargo',
  'fase',
  'tipo_iniciativa',
  'expedientes',
  'hora_inicio',
  'hora_fin',
  'cuenta',
  'motivo_exclusion',
  'url_fuente',
  'url_video',
] as const;

export type CargoClass = 'diputado' | 'cargo_parlamentario' | 'investidura' | 'gobierno' | 'externo';

/** Classifies CARGOORADOR. Only `diputado`, `cargo_parlamentario` and `investidura` count. */
export function classifyCargo(cargo: string): CargoClass {
  const text = clean(cargo);
  if (text === '' || text === 'Diputado' || text === 'Diputada') return 'diputado';
  if (/^Candidat[oa] a la presidencia del Gobierno/i.test(text)) return 'investidura';
  if (
    /^(Ministr[oa]\b|Presidente del Gobierno|Vicepresident[ae]\b.*(Gobierno|[Mm]inistr)|Secretari[oa] de Estado)/i.test(
      text,
    )
  ) {
    return 'gobierno';
  }
  if (
    /^(Presidente|Presidenta|Vicepresident[ae]|Secretari[oa])\b.*(Comisi[oó]n|Subcomisi[oó]n|Ponencia|Mesa|Congreso)/i.test(
      text,
    )
  ) {
    return 'cargo_parlamentario';
  }
  return 'externo';
}

function inGovernment(censusName: string, fecha: string): boolean {
  return governmentMembers.some(
    (term) => term.name === censusName && term.from <= fecha && (term.until === undefined || fecha < term.until),
  );
}

/** "https://app.congreso.es/v1/1525087I https://…" -> "1525087I" */
function videoId(enlace: string): string {
  const first = enlace.trim().split(/\s+/)[0] ?? '';
  return first.split('/').pop() ?? first;
}

export function buildIntervenciones(
  rows: readonly InterventionRow[],
  resolve: (name: string) => string | undefined,
  idOf: (censusName: string) => string,
  terms: Terms,
  organoIdForLabel: (label: string) => string | undefined,
  isPermanentDeputation: (organoId: string) => boolean,
  /**
   * True when the expediente ("180/000123/0000") is an oral question signed by the
   * deputy: formulating one's own question counts as an initiative, not again as a
   * speech (D-033).
   */
  ownOralQuestion: (expediente: string, diputadoId: string) => boolean = () => false,
): IntervencionRow[] {
  const congressGroups = new Set(groups.map((group) => group.code));
  const known = new Set(notDeputies.map((entry) => entry.name));
  const problems: string[] = [];
  const bySpeech = new Map<string, { row: InterventionRow; censusName: string; expedientes: Set<string> }>();

  for (const row of rows) {
    if (row.TIPOINTERVENCION !== 'Intervención' || !row.ORADOR) continue;
    const { name, group } = splitSpeaker(row.ORADOR);
    const censusName = resolve(name);
    if (!censusName) {
      const deputyLike =
        (group !== undefined && congressGroups.has(group)) || /^Diputad[oa]$/.test(clean(row.CARGOORADOR));
      if (deputyLike && !known.has(name)) problems.push(`speaker not in the census: ${row.ORADOR}`);
      continue;
    }
    const key = row.ENLACEDIFERIDO.trim();
    const entry = bySpeech.get(key) ?? { row, censusName, expedientes: new Set<string>() };
    if (entry.censusName !== censusName) problems.push(`one speech, two speakers: ${key}`);
    if (row.NUMEXPEDIENTE) entry.expedientes.add(row.NUMEXPEDIENTE.trim());
    bySpeech.set(key, entry);
  }

  const result: IntervencionRow[] = [];
  const usedIds = new Map<string, number>();
  for (const [key, { row, censusName, expedientes }] of [...bySpeech].sort(([a], [b]) => a.localeCompare(b))) {
    const fecha = isoDate(row.SESION) ?? '';
    const label = clean(row.ORGANO);
    const organoId = organoIdForLabel(label);
    if (!organoId) {
      problems.push(`unknown body label: ${label}`);
      continue;
    }
    const term = terms.get(censusName);
    const inOffice = term !== undefined && term.alta <= fecha && (term.baja === undefined || fecha <= term.baja);
    const cargo = clean(row.CARGOORADOR);
    let clase = classifyCargo(cargo);
    // A government post that the BOE does not confirm for that date is a labelling error.
    if (clase === 'gobierno' && !inGovernment(censusName, fecha)) clase = 'diputado';
    const motivo = !inOffice
      ? 'fuera_de_mandato'
      : isPermanentDeputation(organoId)
        ? 'diputacion_permanente'
        : clase === 'gobierno'
          ? 'cargo_gobierno'
          : clase === 'externo'
            ? 'cargo_externo'
            : [...expedientes].some((expediente) => ownOralQuestion(expediente, idOf(censusName)))
              ? 'pregunta_oral'
              : undefined;
    const base = videoId(key);
    const seen = usedIds.get(base) ?? 0;
    usedIds.set(base, seen + 1);
    result.push({
      intervencion_id: seen === 0 ? base : `${base}-${seen + 1}`,
      fecha,
      organo_id: organoId,
      diputado_id: idOf(censusName),
      cargo_orador: cargo,
      clase_cargo: clase,
      fase: clean(row.FASE) || undefined,
      tipo_iniciativa: clean(row.TIPOINICIATIVA) || undefined,
      expedientes: [...expedientes].sort().join(';') || undefined,
      hora_inicio: row.INICIOINTERVENCION,
      hora_fin: row.FININTERVENCION,
      cuenta: motivo === undefined,
      motivo_exclusion: motivo,
      url_fuente: row.ENLACETEXTOINTEGRO?.trim() || row.ENLACEPDF?.trim() || undefined,
      url_video: key.split(/\s+/)[0] ?? key,
    });
  }
  if (problems.length > 0) {
    throw new Error(
      `Intervention checks failed (${problems.length}): ${[...new Set(problems)].slice(0, 10).join(' | ')}`,
    );
  }
  return result;
}
