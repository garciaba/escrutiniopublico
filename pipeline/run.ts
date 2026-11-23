/**
 * Pipeline orchestrator (specification, section 6): ingest -> normalize -> metrics -> checks.
 * Milestone 1 covers ingest and normalize.
 *
 * Usage: pnpm pipeline [--offline] [--stage ingest|normalize]
 *   --offline  skips the downloads and rebuilds everything from data/raw/.
 */
import { parseArgs } from 'node:util';

import { runIngest } from './ingest/run-ingest.ts';
import { runNormalize } from './normalize/run-normalize.ts';

const { values: args } = parseArgs({
  options: {
    offline: { type: 'boolean', default: false },
    stage: { type: 'string' },
  },
});

const log = (message: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);
const today = new Date().toISOString().slice(0, 10);
const stages = args.stage ? [args.stage] : ['ingest', 'normalize'];

for (const stage of stages) {
  if (stage === 'ingest') {
    if (args.offline) {
      log('ingest: skipped (--offline)');
      continue;
    }
    await runIngest(today, log);
  } else if (stage === 'normalize') {
    await runNormalize(log);
  } else {
    throw new Error(`Unknown stage: ${stage}`);
  }
}
log('pipeline: done');
