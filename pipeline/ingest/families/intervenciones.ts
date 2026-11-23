/** Intervenciones family: one chronological file for the legislature. */
import { interventionsFile } from '../../normalize/schemas.ts';
import type { IngestContext } from '../context.ts';
import { ingestStaticFile } from './static-file.ts';

export async function ingestIntervenciones(ctx: IngestContext, indexHtml: string): Promise<void> {
  // IntervencionesIniciativa holds the same rows in another order (data dictionary 3.3).
  await ingestStaticFile(ctx, 'intervenciones', 'IntervencionesCronologicamente', indexHtml, interventionsFile);
}
