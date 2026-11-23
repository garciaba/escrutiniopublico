/**
 * Where raw downloads live and how they are recorded.
 *
 * - data/raw/daily/: the current dump of each official file. Not versioned (spec,
 *   section 4); it is what an offline run normalizes again.
 * - data/raw/votaciones/: the vote JSON files extracted from each immutable session
 *   ZIP (D-004). Versioned.
 * - data/raw/manifest.json: URL, download date, size and SHA-256 of every source.
 *   An entry only changes when the content changes, so a day without news leaves
 *   the manifest, and the git diff, untouched.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const RAW_DIR = join('data', 'raw');
export const DAILY_DIR = join(RAW_DIR, 'daily');
export const VOTES_DIR = join(RAW_DIR, 'votaciones');
export const MANIFEST_PATH = join(RAW_DIR, 'manifest.json');

export interface ManifestEntry {
  url: string;
  /** yyyy-mm-dd of the download that produced this content. */
  descargado: string;
  bytes: number;
  sha256: string;
}

export type Manifest = Record<string, ManifestEntry>;

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Writes through a temporary file so an interrupted run never leaves half a file. */
export async function writeAtomic(path: string, content: Uint8Array | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, content);
  await rename(`${path}.tmp`, path);
}

export async function loadManifest(path = MANIFEST_PATH): Promise<Manifest> {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as Manifest;
  } catch {
    return {};
  }
}

export async function saveManifest(manifest: Manifest, path = MANIFEST_PATH): Promise<void> {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await writeAtomic(path, `${JSON.stringify(sorted, null, 1)}\n`);
}

/**
 * Records a download. Returns true when the content is new or changed; the entry
 * (and its date) is left as it was when the bytes are identical to the last ones.
 */
export function recordDownload(
  manifest: Manifest,
  key: string,
  url: string,
  bytes: Uint8Array,
  today: string,
): boolean {
  const digest = sha256(bytes);
  const previous = manifest[key];
  if (previous?.sha256 === digest) return false;
  manifest[key] = { url, descargado: today, bytes: bytes.byteLength, sha256: digest };
  return true;
}
