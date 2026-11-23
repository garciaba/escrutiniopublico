/** Órganos family: composition exports of every committee and governing body (D-012). */
import { join } from 'node:path';

import { project } from '../../../config/project.ts';
import { decodeText } from '../../discover/profile.ts';
import { organListFile, organMembersFile, parseOrThrow, type OrganMemberRow } from '../../normalize/schemas.ts';
import { withQuery, type IngestContext } from '../context.ts';
import { DAILY_DIR, recordDownload, writeAtomic } from '../raw-store.ts';

export interface OrganComposition {
  organoSup: number;
  suborgano: string;
  nombre: string;
  miembros: OrganMemberRow[];
}

interface Target {
  path: string;
  organoSup: number;
  suborgano: string;
  nombre: string;
}

async function listTargets(ctx: IngestContext): Promise<Target[]> {
  const { organos, legislatura, baseUrl } = project;
  const targets: Target[] = [
    { ...organos.superiores.mesa, suborgano: '', nombre: 'Mesa del Congreso' },
    { ...organos.superiores.juntaPortavoces, suborgano: '', nombre: 'Junta de Portavoces' },
    { ...organos.superiores.diputacionPermanente, suborgano: '', nombre: 'Diputación Permanente' },
  ];
  for (const tipo of organos.listTipos) {
    const response = await ctx.client.postForm(withQuery(baseUrl, organos.listPath, organos.listQuery), {
      _opendata_tipoConsulta: tipo,
      _opendata_legislatura: String(legislatura.number),
    });
    const list = parseOrThrow(organListFile, JSON.parse(decodeText(response.body)), `organ list ${tipo}`);
    for (const organ of list.datosOrganos) {
      const params = new URL(organ.urlExport, baseUrl).searchParams;
      targets.push({
        path: organos.exportPath,
        organoSup: Number(params.get('_organos_selectedOrganoSup')),
        suborgano: params.get('_organos_selectedSuborgano') ?? '',
        nombre: organ.descOrgano.replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return targets;
}

export async function ingestOrganos(ctx: IngestContext): Promise<void> {
  const { organos, legislatura, baseUrl } = project;
  const compositions: OrganComposition[] = [];
  for (const target of await listTargets(ctx)) {
    const form = {
      _organos_selectedLegislatura: legislatura.roman,
      _organos_compoHistorica: 'true',
      _organos_selectedOrganoSup: String(target.organoSup),
      _organos_selectedSuborgano: target.suborgano,
    };
    const url = withQuery(baseUrl, target.path, {
      ...organos.exportQuery,
      ...form,
      _organos_statusOpenData: 'true',
    });
    const response = await ctx.client.postForm(url, { ...form, _organos_fileType: 'json' });
    const miembros = parseOrThrow(organMembersFile, JSON.parse(decodeText(response.body)), target.nombre);
    compositions.push({ organoSup: target.organoSup, suborgano: target.suborgano, nombre: target.nombre, miembros });
  }
  compositions.sort((a, b) => a.organoSup - b.organoSup || a.suborgano.localeCompare(b.suborgano));
  const bytes = new TextEncoder().encode(`${JSON.stringify(compositions, null, 1)}\n`);
  await writeAtomic(join(DAILY_DIR, 'organos', 'composicion.json'), bytes);
  recordDownload(ctx.manifest, 'organos/composicion', `${baseUrl}/es/opendata/organos`, bytes, ctx.today);
  ctx.log(
    `organos: ${compositions.length} bodies, ${compositions.reduce((n, c) => n + c.miembros.length, 0)} memberships`,
  );
}
