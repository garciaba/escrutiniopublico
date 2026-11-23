/**
 * iniciativas and firmantes tables. Bills come from the open-data files; written
 * questions (184) and information requests (186) come from the initiatives search
 * export with every signer (D-016). firmantes is an addition to the model of the
 * specification: one row per deputy who signs an initiative.
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

export interface FirmanteRow extends Record<string, string | number> {
  iniciativa_id: string;
  orden: number;
  diputado_id: string;
  grupo_id: string;
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

const AUTHOR = /([^()]+?)\s*\(((?:[^()]|\([^()]*\))*)\)/g;

/** "A, B (GP) C, D (GV (EAJ-PNV)) y 45 Diputados" -> [{name: "A, B", group: "GP"}, …] */
export function splitAuthors(text: string): { name: string; group: string }[] {
  const authors: { name: string; group: string }[] = [];
  for (const match of clean(text).matchAll(AUTHOR)) {
    const name = (match[1] ?? '').trim();
    if (/^[^,]+, [^,]+$/.test(name)) authors.push({ name, group: (match[2] ?? '').trim() });
  }
  return authors;
}

/** "Caducado \n04/11/2026" -> { resultado: "Caducado", fecha: "2026-11-04" } */
function splitResult(text: string | undefined): { resultado: string | undefined; fecha: string | undefined } {
  const value = clean(text);
  const match = /^(.*?)\s*(\d{2}\/\d{2}\/\d{4})$/.exec(value);
  if (!match) return { resultado: value || undefined, fecha: undefined };
  return { resultado: match[1] || undefined, fecha: isoDate(match[2]) };
}

export function buildIniciativas(
  bills: readonly BillRow[],
  searchRows: ReadonlyMap<string, readonly SearchInitiativeRow[]>,
  resolve: (name: string) => string | undefined,
  idOf: (censusName: string) => string,
): { iniciativas: IniciativaRow[]; firmantes: FirmanteRow[] } {
  const congressGroups = new Set(groups.map((group) => group.code));
  const iniciativas: IniciativaRow[] = [];
  const firmantes: FirmanteRow[] = [];
  const problems: string[] = [];

  const addSigners = (iniciativaId: string, text: string): number => {
    const signers: { censusName: string; group: string }[] = [];
    for (const author of splitAuthors(text)) {
      const censusName = resolve(author.name);
      if (censusName) signers.push({ censusName, group: author.group });
      else if (congressGroups.has(author.group))
        problems.push(`${iniciativaId}: signer not in the census: ${author.name}`);
    }
    signers.forEach((signer, index) =>
      firmantes.push({
        iniciativa_id: iniciativaId,
        orden: index + 1,
        diputado_id: idOf(signer.censusName),
        grupo_id: signer.group,
        n_firmantes: signers.length,
      }),
    );
    return signers.length;
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
  return { iniciativas, firmantes };
}
