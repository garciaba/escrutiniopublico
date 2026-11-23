/**
 * Ingest stage: reads the five index pages once and runs every family adapter.
 * Any failure (network, schema, missing link) stops the stage with an error.
 */
import { project } from '../../config/project.ts';
import { decodeText } from '../discover/profile.ts';
import type { IngestContext } from './context.ts';
import { ingestDiputados } from './families/diputados.ts';
import { ingestIniciativas } from './families/iniciativas.ts';
import { ingestIntervenciones } from './families/intervenciones.ts';
import { ingestOrganos } from './families/organos.ts';
import { ingestVotaciones } from './families/votaciones.ts';
import { PoliteClient } from './http.ts';
import { loadManifest, saveManifest } from './raw-store.ts';

export async function runIngest(
  today: string,
  log: (message: string) => void,
  options: { reuseDaily?: boolean } = {},
): Promise<void> {
  const ctx: IngestContext = {
    client: new PoliteClient(project.http),
    manifest: await loadManifest(),
    today,
    reuseDaily: options.reuseDaily ?? false,
    log,
  };
  const index: Record<string, string> = {};
  for (const [family, path] of Object.entries(project.indexPages)) {
    index[family] = decodeText((await ctx.client.get(new URL(path, project.baseUrl).toString())).body);
  }
  const page = (family: keyof typeof project.indexPages) => {
    const html = index[family];
    if (html === undefined) throw new Error(`Index page ${family} missing`);
    return html;
  };
  try {
    await ingestDiputados(ctx, page('diputados'));
    await ingestIntervenciones(ctx, page('intervenciones'));
    await ingestOrganos(ctx);
    await ingestVotaciones(ctx, page('votaciones'));
    await ingestIniciativas(ctx, page('iniciativas'));
  } finally {
    // Whatever was downloaded is recorded, also when a later family fails.
    await saveManifest(ctx.manifest);
  }
}
