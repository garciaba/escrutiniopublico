/**
 * votaciones and votos tables, from the vote JSON files kept unmodified under
 * data/raw/votaciones (D-004). Every check found in milestone 0 is enforced: totals
 * add up, every voter is a census deputy, and the roster of each vote is exactly the
 * deputies in office that day (the day of a resignation may go either way).
 */
import type { VoteFile } from '../schemas.ts';
import { isoDate } from '../util.ts';

export interface VoteSource {
  legislatura: number;
  sesion: number;
  numero: number;
  zipUrl: string;
  file: VoteFile;
}

export interface VotacionRow extends Record<string, string | number | boolean | undefined> {
  votacion_id: string;
  legislatura: number;
  sesion: number;
  numero: number;
  fecha: string;
  titulo: string;
  texto_expediente: string;
  subgrupo_titulo: string | undefined;
  subgrupo_texto: string | undefined;
  votaciones_conjuntas: number;
  asentimiento: boolean;
  nominal: boolean;
  presentes: number;
  a_favor: number;
  en_contra: number;
  abstenciones: number;
  no_votan: number;
  url_fuente: string;
}

export const VOTACION_COLUMNS = [
  'votacion_id',
  'legislatura',
  'sesion',
  'numero',
  'fecha',
  'titulo',
  'texto_expediente',
  'subgrupo_titulo',
  'subgrupo_texto',
  'votaciones_conjuntas',
  'asentimiento',
  'nominal',
  'presentes',
  'a_favor',
  'en_contra',
  'abstenciones',
  'no_votan',
  'url_fuente',
] as const;

export type Sentido = 'si' | 'no' | 'abstencion' | 'no_vota';

export interface VotoRow extends Record<string, string | boolean> {
  votacion_id: string;
  diputado_id: string;
  sentido: Sentido;
  /** asiento = -1; most likely a remote vote, not officially documented (D-010). */
  telematico: boolean;
  grupo_id: string;
}

export const VOTO_COLUMNS = ['votacion_id', 'diputado_id', 'sentido', 'telematico', 'grupo_id'] as const;

const SENTIDO: Readonly<Record<string, Sentido>> = {
  Sí: 'si',
  No: 'no',
  Abstención: 'abstencion',
  'No vota': 'no_vota',
};

export function votacionId(legislatura: number, sesion: number, numero: number): string {
  return `L${legislatura}-S${String(sesion).padStart(3, '0')}-V${String(numero).padStart(3, '0')}`;
}

/** Deputy terms used by the roster check: census name -> [alta, baja] (yyyy-mm-dd). */
export type Terms = ReadonlyMap<string, { alta: string; baja: string | undefined }>;

export function buildVotaciones(
  sources: readonly VoteSource[],
  resolve: (name: string) => string | undefined,
  idOf: (censusName: string) => string,
  terms: Terms,
): { votaciones: VotacionRow[]; votos: VotoRow[] } {
  const votaciones: VotacionRow[] = [];
  const votos: VotoRow[] = [];
  const problems: string[] = [];
  for (const { legislatura, sesion, numero, zipUrl, file } of sources) {
    const id = votacionId(legislatura, sesion, numero);
    const fecha = isoDate(file.informacion.fecha) ?? '';
    const t = file.totales;
    if (t.presentes !== t.afavor + t.enContra + t.abstenciones) problems.push(`${id}: presentes does not add up`);
    const rows = file.votaciones;
    if (rows.length > 0) {
      const count = (value: string) => rows.filter((row) => row.voto === value).length;
      if (count('Sí') !== t.afavor || count('No') !== t.enContra || count('Abstención') !== t.abstenciones) {
        problems.push(`${id}: nominal rows do not match the totals`);
      }
      const voters = new Set<string>();
      for (const row of rows) {
        const censusName = resolve(row.diputado);
        if (!censusName) {
          problems.push(`${id}: voter not in the census: ${row.diputado}`);
          continue;
        }
        voters.add(censusName);
        votos.push({
          votacion_id: id,
          diputado_id: idOf(censusName),
          sentido: SENTIDO[row.voto] ?? 'no_vota',
          telematico: row.asiento === '-1',
          grupo_id: row.grupo,
        });
      }
      for (const [name, term] of terms) {
        const surelyActive = term.alta <= fecha && (term.baja === undefined || fecha < term.baja);
        const maybeActive = term.alta <= fecha && (term.baja === undefined || fecha <= term.baja);
        if (surelyActive && !voters.has(name)) problems.push(`${id}: ${name} in office but not in the roster`);
        if (!maybeActive && voters.has(name)) problems.push(`${id}: ${name} in the roster but not in office`);
      }
    }
    votaciones.push({
      votacion_id: id,
      legislatura,
      sesion,
      numero,
      fecha,
      titulo: file.informacion.titulo.trim(),
      texto_expediente: file.informacion.textoExpediente.trim(),
      subgrupo_titulo: file.informacion.tituloSubGrupo.trim() || undefined,
      subgrupo_texto: file.informacion.textoSubGrupo.trim() || undefined,
      votaciones_conjuntas: file.informacion.votacionesConjuntas.length,
      asentimiento: t.asentimiento === 'Sí',
      nominal: rows.length > 0,
      presentes: t.presentes,
      a_favor: t.afavor,
      en_contra: t.enContra,
      abstenciones: t.abstenciones,
      no_votan: t.noVotan,
      url_fuente: zipUrl,
    });
  }
  if (problems.length > 0) {
    throw new Error(`Vote checks failed (${problems.length}): ${problems.slice(0, 10).join(' | ')}`);
  }
  return { votaciones, votos };
}
