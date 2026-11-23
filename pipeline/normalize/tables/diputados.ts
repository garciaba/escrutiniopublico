/**
 * diputados and grupos tables. The census (DiputadosActivos + DiputadosDeBaja) is the
 * list of people; the deputy search adds the official code (D-015). Both must name
 * exactly the same people, or the run stops.
 */
import { formationToParty, groups } from '../../../config/parties.ts';
import { project } from '../../../config/project.ts';
import type { CensusRow, SearchDeputy } from '../schemas.ts';
import { diputadoId, isoDate, slugFromName, splitCensusName } from '../util.ts';

export interface DiputadoRow extends Record<string, string | number | undefined> {
  diputado_id: string;
  legislatura: number;
  cod_parlamentario: number;
  nombre_completo: string;
  nombre: string;
  apellidos: string;
  slug: string;
  grupo_id: string;
  formacion: string;
  partido: string;
  circunscripcion: string;
  id_circunscripcion: number;
  fecha_alta: string;
  fecha_baja: string | undefined;
  fecha_condicion_plena: string;
  fecha_alta_grupo: string;
  fecha_baja_grupo: string | undefined;
  url_ficha_oficial: string;
  rol_especial: string;
}

export const DIPUTADO_COLUMNS = [
  'diputado_id',
  'legislatura',
  'cod_parlamentario',
  'nombre_completo',
  'nombre',
  'apellidos',
  'slug',
  'grupo_id',
  'formacion',
  'partido',
  'circunscripcion',
  'id_circunscripcion',
  'fecha_alta',
  'fecha_baja',
  'fecha_condicion_plena',
  'fecha_alta_grupo',
  'fecha_baja_grupo',
  'url_ficha_oficial',
  'rol_especial',
] as const;

export interface GrupoRow extends Record<string, string | number> {
  grupo_id: string;
  nombre: string;
  nombre_corto: string;
  miembros_censo: number;
}

export const GRUPO_COLUMNS = ['grupo_id', 'nombre', 'nombre_corto', 'miembros_censo'] as const;

export function officialProfileUrl(cod: number): string {
  const url = new URL(project.fichaDiputado.path, project.baseUrl);
  url.search = new URLSearchParams({
    p_p_id: 'diputadomodule',
    p_p_lifecycle: '0',
    p_p_state: 'normal',
    p_p_mode: 'view',
    _diputadomodule_mostrarFicha: 'true',
    codParlamentario: String(cod),
    idLegislatura: project.legislatura.roman,
  }).toString();
  return url.toString();
}

/** Builds the deputies of the legislature; `roles` maps census names to special roles. */
export function buildDiputados(
  census: readonly CensusRow[],
  search: readonly SearchDeputy[],
  roles: ReadonlyMap<string, readonly string[]>,
): DiputadoRow[] {
  const legislatura = project.legislatura.number;
  const byName = new Map(search.map((deputy) => [deputy.apellidosNombre, deputy]));
  const censusNames = new Set(census.map((row) => row.NOMBRE));
  const missingCode = [...censusNames].filter((name) => !byName.has(name));
  const missingCensus = [...byName.keys()].filter((name) => !censusNames.has(name));
  if (census.length !== censusNames.size) throw new Error('Duplicated names in the census');
  if (missingCode.length > 0 || missingCensus.length > 0) {
    throw new Error(
      `Census and deputy search disagree. Without code: ${missingCode.join('; ') || '-'}. Not in census: ${missingCensus.join('; ') || '-'}`,
    );
  }
  const groupByName = new Map(groups.map((group) => [group.name, group.code]));
  const rows = census.map((row): DiputadoRow => {
    const official = byName.get(row.NOMBRE);
    const grupo = groupByName.get(row.GRUPOPARLAMENTARIO);
    const partido = formationToParty[row.FORMACIONELECTORAL];
    if (!official) throw new Error(`No official code for ${row.NOMBRE}`);
    if (!grupo) throw new Error(`Unknown parliamentary group: ${row.GRUPOPARLAMENTARIO}`);
    if (!partido) throw new Error(`Unknown electoral formation: ${row.FORMACIONELECTORAL}`);
    const { nombre, apellidos } = splitCensusName(row.NOMBRE);
    return {
      diputado_id: diputadoId(legislatura, row.NOMBRE),
      legislatura,
      cod_parlamentario: official.codParlamentario,
      nombre_completo: row.NOMBRE,
      nombre,
      apellidos,
      slug: slugFromName(row.NOMBRE),
      grupo_id: grupo,
      formacion: row.FORMACIONELECTORAL,
      partido,
      circunscripcion: row.CIRCUNSCRIPCION,
      id_circunscripcion: official.idCircunscripcion,
      fecha_alta: isoDate(row.FECHAALTA) ?? '',
      fecha_baja: isoDate(row.FECHABAJA),
      fecha_condicion_plena: isoDate(row.FECHACONDICIONPLENA) ?? '',
      fecha_alta_grupo: isoDate(row.FECHAALTAENGRUPOPARLAMENTARIO) ?? '',
      fecha_baja_grupo: isoDate(row.FECHABAJAENGRUPOPARLAMENTARIO),
      url_ficha_oficial: officialProfileUrl(official.codParlamentario),
      rol_especial: [...(roles.get(row.NOMBRE) ?? [])].sort().join('|'),
    };
  });
  const slugs = new Map<string, number>();
  for (const row of rows) slugs.set(row.slug, (slugs.get(row.slug) ?? 0) + 1);
  for (const row of rows) {
    if ((slugs.get(row.slug) ?? 0) > 1) row.slug = `${row.slug}-${row.cod_parlamentario}`;
  }
  return rows;
}

export function buildGrupos(diputados: readonly DiputadoRow[]): GrupoRow[] {
  return groups.map((group) => ({
    grupo_id: group.code,
    nombre: group.name,
    nombre_corto: group.shortName,
    miembros_censo: diputados.filter((row) => row.grupo_id === group.code).length,
  }));
}
