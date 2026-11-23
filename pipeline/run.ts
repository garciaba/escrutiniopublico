/**
 * Pipeline orchestrator (specification, section 6): ingest -> normalize -> metrics.
 * The pre-publication checks arrive with a later milestone.
 *
 * Usage: pnpm pipeline [--offline] [--reuse-daily] [--stage ingest|normalize|metrics] [--date yyyy-mm-dd]
 *   --offline  skips the downloads. Normalization runs only if the daily dumps are
 *              present (they are not versioned); the metrics always run, from the
 *              versioned tables of data/normalized/.
 *   --date     calculation date of the metrics (default: today, UTC).
 *   --reuse-daily  reuses the daily dumps already on disk and downloads only the missing
 *              ones (to resume an interrupted run).
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { runIngest } from './ingest/run-ingest.ts';
import { DAILY_DIR } from './ingest/raw-store.ts';
import { runMetrics } from './metrics/run-metrics.ts';
import { runNormalize } from './normalize/run-normalize.ts';

const { values: args } = parseArgs({
  options: {
    offline: { type: 'boolean', default: false },
    stage: { type: 'string' },
    date: { type: 'string' },
    'reuse-daily': { type: 'boolean', default: false },
  },
});

// The only place where the clock is read.
const now = new Date();
const today = now.toISOString().slice(0, 10);
const fechaCalculo = args.date ?? today;
if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCalculo)) throw new Error(`--date must be yyyy-mm-dd, got ${fechaCalculo}`);

const log = (message: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);

function currentCommit(): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

const stages = args.stage ? [args.stage] : ['ingest', 'normalize', 'metrics'];
for (const stage of stages) {
  if (stage === 'ingest') {
    if (args.offline) log('ingest: skipped (--offline)');
    else await runIngest(today, log, { reuseDaily: args['reuse-daily'] });
  } else if (stage === 'normalize') {
    if (args.offline && !existsSync(DAILY_DIR)) {
      log('normalize: skipped (--offline and no daily dumps); using the versioned tables');
    } else {
      await runNormalize(log);
    }
  } else if (stage === 'metrics') {
    await runMetrics({ fechaCalculo, ejecutado: now.toISOString(), commit: currentCommit() }, log);
  } else {
    throw new Error(`Unknown stage: ${stage}`);
  }
}
log('pipeline: done');
