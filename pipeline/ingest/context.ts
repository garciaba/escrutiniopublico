/** Shared state of one ingest run, passed to every family adapter. */
import { existsSync } from 'node:fs';

import type { PoliteClient } from './http.ts';
import type { Manifest } from './raw-store.ts';

export interface IngestContext {
  client: PoliteClient;
  manifest: Manifest;
  /** yyyy-mm-dd of the run (the clock is read once, in the orchestrator). */
  today: string;
  /**
   * Reuse the daily dumps already on disk and download only the missing ones. For
   * resuming an interrupted run; a scheduled run always downloads everything.
   */
  reuseDaily: boolean;
  log: (message: string) => void;
}

/** True when a daily dump can be reused instead of downloaded again. */
export function reusable(ctx: IngestContext, path: string): boolean {
  if (!ctx.reuseDaily || !existsSync(path)) return false;
  ctx.log(`reusing ${path}`);
  return true;
}

export function withQuery(baseUrl: string, path: string, query: Readonly<Record<string, string>>): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}
