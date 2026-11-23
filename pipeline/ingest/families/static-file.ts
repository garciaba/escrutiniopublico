/** Downloads the current version of a timestamped open-data file linked from an index page. */
import { join } from 'node:path';
import type { z } from 'zod';

import { project } from '../../../config/project.ts';
import { decodeText } from '../../discover/profile.ts';
import { parseOrThrow } from '../../normalize/schemas.ts';
import { reusable, type IngestContext } from '../context.ts';
import { extractDownloadLinks, pickDatasetLink } from '../index-page.ts';
import { DAILY_DIR, recordDownload, writeAtomic } from '../raw-store.ts';

/**
 * Finds the file with `prefix` on the index page, downloads it, validates it against
 * `schema` and stores it as data/raw/daily/<family>/<prefix>.json.
 */
export async function ingestStaticFile<T>(
  ctx: IngestContext,
  family: string,
  prefix: string,
  indexHtml: string,
  schema: z.ZodType<T>,
): Promise<void> {
  const target = join(DAILY_DIR, family, `${prefix}.json`);
  if (reusable(ctx, target)) return;
  const link = pickDatasetLink(extractDownloadLinks(indexHtml, project.baseUrl), prefix, ['json']);
  if (!link) throw new Error(`No JSON link with prefix ${prefix} on the ${family} index page`);
  const response = await ctx.client.get(link.url);
  parseOrThrow(schema, JSON.parse(decodeText(response.body)), link.fileName);
  await writeAtomic(target, response.body);
  const changed = recordDownload(ctx.manifest, `${family}/${prefix}`, link.url, response.body, ctx.today);
  ctx.log(`${family}/${prefix}: ${response.body.byteLength} bytes${changed ? ', new content' : ', unchanged'}`);
}
