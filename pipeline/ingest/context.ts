/** Shared state of one ingest run, passed to every family adapter. */
import type { PoliteClient } from './http.ts';
import type { Manifest } from './raw-store.ts';

export interface IngestContext {
  client: PoliteClient;
  manifest: Manifest;
  /** yyyy-mm-dd of the run (the clock is read once, in the orchestrator). */
  today: string;
  log: (message: string) => void;
}

export function withQuery(baseUrl: string, path: string, query: Readonly<Record<string, string>>): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}
