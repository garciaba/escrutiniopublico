/**
 * iniciativas and firmantes tables. Bills come from the open-data files; written
 * questions and information requests come from the initiatives search export with
 * every signer (D-016). firmantes is an addition to the model of the specification:
 * one row per deputy who signs an initiative.
 */
import { groups } from '../../../config/parties.ts';
import { project } from '../../../config/project.ts';
import type { BillRow, SearchInitiativeRow } from '../schemas.ts';
import { clean, isoDate } from '../util.ts';

export interface IniciativaRow extends Record<string, string | number | boolean | undefined> {
  iniciativa_id: string;
  tipo_codigo: string;
  tipo: string;
  titulo: string;
  fecha_presentacion: string | undefined;
  fecha_calificacion: string | undefined;
  autor: string | undefined;
  n_firmantes: number;
  firmantes_incompletos: boolean;
  resultado: string | undefined;
  fecha_resultado: string | undefined;
  url_fuente: string;
}

export const INICIATIVA_COLUMNS = [
  'iniciativa_id',
  'tipo_codigo',
  'tipo',
  'titulo',
  'fecha_presentacion',
  'fecha_calificacion',
  'autor',
  'n_firmantes',
  'firmantes_incompletos',
  'resultado',
  'fecha_resultado',
  'url_fuente',
] as const;

export interface FirmanteRow extends Record<string, string | number | undefined> {
  iniciativa_id: string;
  orden: number;
  diputado_id: string;
  /** Group code written next to the name; empty when the source omits it. */
  grupo_id: string | undefined;
  n_firmantes: number;
}

export const FIRMANTE_COLUMNS = ['iniciativa_id', 'orden', 'diputado_id', 'grupo_id', 'n_firmantes'] as const;

/** "122/000001/0000" -> "122/000001" */
export function expedienteId(numero: string): string {
  return numero.trim().split('/').slice(0, 2).join('/');
}

export function initiativeUrl(iniciativaId: string): string {
  const url = new URL(project.iniciativasBuscador.path, project.baseUrl);
  url.search = new URLSearchParams({
    p_p_id: 'iniciativas',
    p_p_lifecycle: '0',
    p_p_state: 'normal',
    p_p_mode: 'view',
    _iniciativas_mode: 'mostrarDetalle',
    _iniciativas_legislatura: project.legislatura.roman,
    _iniciativas_id: iniciativaId,
  }).toString();
  return url.toString();
}

export interface AuthorSegment {
  /** Text before a group code, or left over after the last one. May hold several names. */
  text: string;
  group: string | undefined;
}

const GROUP_CODE = /\s*\(((?:[^()]|\([^()]*\))*)\)\s*/g;

/**
 * Cuts the author field at each group code:
 * "A, B (GP) C, D E, F (GV (EAJ-PNV)) y 45 Diputados" ->
 * [{A, B | GP}, {C, D E, F | GV (EAJ-PNV)}, {y 45 Diputados | -}].
 * A segment can hold two names when the source omits the code of the first one.
 */
export function splitAuthors(text: string): AuthorSegment[] {
  const value = clean(text);
  const segments: AuthorSegment[] = [];
  let position = 0;
  for (const match of value.matchAll(GROUP_CODE)) {
    const name = value.slice(position, match.index).trim();
    position = match.index + match[0].length;
    if (name) segments.push({ text: name, group: (match[1] ?? '').trim() });
  }
  const rest = value.slice(position).trim();
  if (rest) segments.push({ text: rest, group: undefined });
  return segments;
}

/**
 * Census names written in a segment. One name resolves directly; several names
 * glued together ("A, B C, D") are split at the space where both sides resolve.
 * Returns undefined when the text is not made of census names only.
 */
export function namesInSegment(text: string, resolve: (name: string) => string | undefined): string[] | undefined {
  const whole = resolve(text);
  if (whole) return [whole];
  const words = text.split(' ');
  for (let cut = 2; cut <= words.length - 2; cut++) {
    const first = resolve(words.slice(0, cut).join(' '));
    if (!first) continue;
    const others = namesInSegment(words.slice(cut).join(' '), resolve);
    if (others) return [first, ...others];
  }
  return undefined;
}

/** "Caducado \n04/11/2026" -> { resultado: "Caducado", fecha: "2026-11-04" } */
function splitResult(text: string | undefined): { resultado: string | undefined; fecha: string | undefined } {
  const value = clean(text);
  const match = /^(.*?)\s*(\d{2}\/\d{2}\/\d{4})$/.exec(value);
  if (!match) return { resultado: value || undefined, fecha: undefined };
  return { resultado: match[1] || undefined, fecha: isoDate(match[2]) };
}

export interface IniciativasResult {
  iniciativas: IniciativaRow[];
  firmantes: FirmanteRow[];
  /** Author texts without a Congreso group code that match no deputy (senators, groups…). */
  autoresNoDiputados: Map<string, number>;
}

export function buildIniciativas(
  bills: readonly BillRow[],
  searchRows: ReadonlyMap<string, readonly SearchInitiativeRow[]>,
  resolve: (name: string) => string | undefined,
  idOf: (censusName: string) => string,
): IniciativasResult {
  const congressGroups = new Set(groups.map((group) => group.code));
  const iniciativas: IniciativaRow[] = [];
  const firmantes: FirmanteRow[] = [];
  const autoresNoDiputados = new Map<string, number>();
  const problems: string[] = [];

  const addSigners = (iniciativaId: string, text: string): number => {
    const signers: { censusName: string; group: string | undefined }[] = [];
    for (const segment of splitAuthors(text)) {
      const names = namesInSegment(segment.text, resolve);
      if (names) {
        // When two names share a code, it is written after the last one only.
        names.forEach((censusName, i) =>
          signers.push({ censusName, group: i === names.length - 1 ? segment.group : undefined }),
        );
      } else if (segment.group !== undefined && congressGroups.has(segment.group)) {
        // A Congreso group code next to a name that is not in the census: never dropped in silence.
        problems.push(`${iniciativaId}: signer not in the census: ${segment.text}`);
      } else {
        const key = segment.group ? `${segment.text} (${segment.group})` : segment.text;
        autoresNoDiputados.set(key, (autoresNoDiputados.get(key) ?? 0) + 1);
      }
    }
    const unique = [...new Map(signers.map((signer) => [signer.censusName, signer])).values()];
    unique.forEach((signer, index) =>
      firmantes.push({
        iniciativa_id: iniciativaId,
        orden: index + 1,
        diputado_id: idOf(signer.censusName),
        grupo_id: signer.group || undefined,
        n_firmantes: unique.length,
      }),
    );
    return unique.length;
  };

  for (const bill of bills) {
    const id = expedienteId(bill.NUMEXPEDIENTE);
    const byDeputies = /de Diputados$/.test(clean(bill.TIPO));
    const { resultado, fecha } = splitResult(bill.RESULTADOTRAMITACION);
    iniciativas.push({
      iniciativa_id: id,
      tipo_codigo: id.slice(0, 3),
      tipo: clean(bill.TIPO),
      titulo: clean(bill.OBJETO),
      fecha_presentacion: isoDate(bill.FECHAPRESENTACION),
      fecha_calificacion: isoDate(bill.FECHACALIFICACION),
      autor: clean(bill.AUTOR) || undefined,
      n_firmantes: byDeputies ? addSigners(id, bill.AUTOR) : 0,
      firmantes_incompletos: byDeputies && /y \d+ Diputad/.test(clean(bill.AUTOR)),
      resultado,
      fecha_resultado: fecha,
      url_fuente: initiativeUrl(id),
    });
  }

  for (const { codigo, nombre } of project.iniciativasBuscador.tipos) {
    for (const row of searchRows.get(codigo) ?? []) {
      const id = row.id_iniciativa;
      const { resultado, fecha } = splitResult(row.resultado_tram);
      iniciativas.push({
        iniciativa_id: id,
        tipo_codigo: codigo,
        tipo: nombre,
        titulo: clean(row.titulo),
        fecha_presentacion: isoDate(row.fecha_presentado || undefined),
        fecha_calificacion: isoDate(row.fecha_calificado || undefined),
        autor: undefined,
        n_firmantes: addSigners(id, row.autor),
        firmantes_incompletos: false,
        resultado,
        fecha_resultado: fecha,
        url_fuente: initiativeUrl(id),
      });
    }
  }
  if (problems.length > 0) {
    throw new Error(`Initiative checks failed (${problems.length}): ${problems.slice(0, 10).join(' | ')}`);
  }
  return { iniciativas, firmantes, autoresNoDiputados };
}
