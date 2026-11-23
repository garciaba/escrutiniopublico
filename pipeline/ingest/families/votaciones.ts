/**
 * Votaciones family. Session ZIPs are immutable: each is downloaded once and only
 * its vote JSON files are kept, unmodified, under data/raw/votaciones/Leg<n>/Sesion<s>/
 * (decision D-004). data/raw/votaciones/Leg<n>/index.json records the voting days
 * already processed and, per session, the ZIP's URL and SHA-256.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unzipSync } from 'fflate';

import { project } from '../../../config/project.ts';
import { decodeText } from '../../discover/profile.ts';
import { parseOrThrow, voteFile } from '../../normalize/schemas.ts';
import type { IngestContext } from '../context.ts';
import { extractSessionZips, extractVotingDays, votingDayUrl } from '../index-page.ts';
import { VOTES_DIR, recordDownload, sha256, writeAtomic } from '../raw-store.ts';

export interface VotesIndex {
  legislatura: number;
  /** Voting day (yyyymmdd) -> sessions found on that day. */
  dias: Record<string, { sesion: number; zip: string; sha256: string; votaciones: number }[]>;
}

export function votesLegislatureDir(legislatura: number): string {
  return join(VOTES_DIR, `Leg${legislatura}`);
}

export async function loadVotesIndex(legislatura: number): Promise<VotesIndex> {
  try {
    return JSON.parse(await readFile(join(votesLegislatureDir(legislatura), 'index.json'), 'utf-8')) as VotesIndex;
  } catch {
    return { legislatura, dias: {} };
  }
}

/** "sesion202votacion7.json" -> 7 */
function voteNumber(fileName: string): number {
  const match = /votacion(\d+)\.json$/.exec(fileName);
  if (!match?.[1]) throw new Error(`Unexpected file in session ZIP: ${fileName}`);
  return Number(match[1]);
}

export async function ingestVotaciones(ctx: IngestContext, indexHtml: string): Promise<void> {
  const { legislatura, baseUrl, votaciones } = project;
  const dir = votesLegislatureDir(legislatura.number);
  const index = await loadVotesIndex(legislatura.number);
  const days = extractVotingDays(indexHtml);
  if (days.length === 0) throw new Error('No voting days found on the votaciones index page');
  const pending = days.filter((day) => !(day in index.dias));
  ctx.log(`votaciones: ${days.length} voting days, ${pending.length} not yet downloaded`);

  for (const day of pending) {
    const pageUrl = votingDayUrl(baseUrl, votaciones.dayPagePath, votaciones.dayPageQuery, legislatura.roman, day);
    const zips = extractSessionZips(decodeText((await ctx.client.get(pageUrl)).body), baseUrl);
    if (zips.length === 0) throw new Error(`No session ZIP on the page of voting day ${day}`);
    const sessions: VotesIndex['dias'][string] = [];
    for (const zip of zips) {
      const response = await ctx.client.get(zip.url);
      const entries = unzipSync(response.body);
      let count = 0;
      for (const [name, bytes] of Object.entries(entries)) {
        if (!name.endsWith('.json')) continue;
        parseOrThrow(voteFile, JSON.parse(decodeText(bytes)), `${zip.fileName}/${name}`);
        const file = `votacion${String(voteNumber(name)).padStart(3, '0')}.json`;
        await writeAtomic(join(dir, `Sesion${String(zip.sesion).padStart(3, '0')}`, file), bytes);
        count++;
      }
      recordDownload(
        ctx.manifest,
        `votaciones/Leg${zip.legislatura}/Sesion${zip.sesion}`,
        zip.url,
        response.body,
        ctx.today,
      );
      sessions.push({ sesion: zip.sesion, zip: zip.url, sha256: sha256(response.body), votaciones: count });
      ctx.log(`votaciones: session ${zip.sesion} (${day}), ${count} vote files`);
    }
    index.dias[day] = sessions;
    // Saved after every day, so an interrupted run resumes where it stopped.
    const sortedDays = Object.fromEntries(Object.entries(index.dias).sort(([a], [b]) => a.localeCompare(b)));
    await writeAtomic(join(dir, 'index.json'), `${JSON.stringify({ ...index, dias: sortedDays }, null, 1)}\n`);
  }
}
