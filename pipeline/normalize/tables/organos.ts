/**
 * organos and pertenencias tables, from the composition exports (D-012) plus the
 * bodies that have no export (Pleno, Sesión Conjunta). Senators (groups SG*) and the
 * committees' legal staff (Letrados) are not deputies and are left out; any other
 * name that does not resolve to the census stops the run (D-008).
 */
import { fixedBodies, organoTipoFromName, type OrganoTipo } from '../../../config/organos.ts';
import { governmentMembers } from '../../../config/overrides.ts';
import { project } from '../../../config/project.ts';
import type { OrganComposition } from '../../ingest/families/organos.ts';
import { isoDate } from '../util.ts';

export interface OrganoRow extends Record<string, string | number | undefined> {
  organo_id: string;
  nombre: string;
  tipo: OrganoTipo;
  organo_sup: number | undefined;
  suborgano: string | undefined;
}

export const ORGANO_COLUMNS = ['organo_id', 'nombre', 'tipo', 'organo_sup', 'suborgano'] as const;

export interface PertenenciaRow extends Record<string, string | undefined> {
  diputado_id: string;
  organo_id: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin: string | undefined;
  grupo_id: string | undefined;
}

export const PERTENENCIA_COLUMNS = [
  'diputado_id',
  'organo_id',
  'cargo',
  'fecha_inicio',
  'fecha_fin',
  'grupo_id',
] as const;

const SUPERIOR_IDS: Readonly<Record<number, { id: string; tipo: OrganoTipo }>> = {
  [project.organos.superiores.mesa.organoSup]: { id: 'mesa', tipo: 'mesa' },
  [project.organos.superiores.juntaPortavoces.organoSup]: { id: 'junta-portavoces', tipo: 'junta_portavoces' },
  [project.organos.superiores.diputacionPermanente.organoSup]: {
    id: 'diputacion-permanente',
    tipo: 'diputacion_permanente',
  },
};

export function organoIdFor(composition: Pick<OrganComposition, 'organoSup' | 'suborgano'>): string {
  return SUPERIOR_IDS[composition.organoSup]?.id ?? `c${composition.organoSup}-${composition.suborgano}`;
}

export function buildOrganos(compositions: readonly OrganComposition[]): OrganoRow[] {
  const rows = new Map<string, OrganoRow>();
  for (const body of fixedBodies) {
    rows.set(body.id, {
      organo_id: body.id,
      nombre: body.nombre,
      tipo: body.tipo,
      organo_sup: undefined,
      suborgano: undefined,
    });
  }
  for (const composition of compositions) {
    const id = organoIdFor(composition);
    const tipo = SUPERIOR_IDS[composition.organoSup]?.tipo ?? organoTipoFromName(composition.nombre);
    rows.set(id, {
      organo_id: id,
      nombre: composition.nombre,
      tipo,
      organo_sup: composition.organoSup,
      suborgano: composition.suborgano || undefined,
    });
  }
  return [...rows.values()];
}

function isExcludedMember(member: OrganComposition['miembros'][number]): boolean {
  return (member.Grupo ?? '').startsWith('SG') || /^Letrad/i.test(member.Cargo);
}

/**
 * Memberships of deputies. `resolve` maps any written name to the census name and
 * `idOf` the census name to diputado_id.
 */
export function buildPertenencias(
  compositions: readonly OrganComposition[],
  resolve: (name: string) => string | undefined,
  idOf: (censusName: string) => string,
): PertenenciaRow[] {
  const rows: PertenenciaRow[] = [];
  const unresolved: string[] = [];
  for (const composition of compositions) {
    for (const member of composition.miembros) {
      if (isExcludedMember(member)) continue;
      const censusName = resolve(member.Nombre);
      if (!censusName) {
        unresolved.push(`${member.Nombre} (${composition.nombre})`);
        continue;
      }
      rows.push({
        diputado_id: idOf(censusName),
        organo_id: organoIdFor(composition),
        cargo: member.Cargo,
        fecha_inicio: isoDate(member.FechaAlta) ?? '',
        fecha_fin: isoDate(member.FechaBaja || undefined),
        grupo_id: member.Grupo || undefined,
      });
    }
  }
  if (unresolved.length > 0) {
    throw new Error(`Body members that are not in the census: ${[...new Set(unresolved)].join('; ')}`);
  }
  const unique = new Map(
    rows.map((row) => [[row.diputado_id, row.organo_id, row.fecha_inicio, row.cargo].join('|'), row]),
  );
  return [...unique.values()];
}

/** Census name -> special roles (specification, section 5): gobierno, mesa, portavoz. */
export function specialRoles(
  compositions: readonly OrganComposition[],
  resolve: (name: string) => string | undefined,
): Map<string, string[]> {
  const roles = new Map<string, Set<string>>();
  const add = (name: string | undefined, role: string) => {
    if (!name) return;
    roles.set(name, (roles.get(name) ?? new Set()).add(role));
  };
  for (const term of governmentMembers) add(term.name, 'gobierno');
  for (const composition of compositions) {
    const id = organoIdFor(composition);
    for (const member of composition.miembros) {
      if (isExcludedMember(member)) continue;
      if (id === 'mesa') add(resolve(member.Nombre), 'mesa');
      if (id === 'junta-portavoces' && member.Cargo === 'Portavoces titulares') add(resolve(member.Nombre), 'portavoz');
    }
  }
  return new Map([...roles].map(([name, set]) => [name, [...set]]));
}
