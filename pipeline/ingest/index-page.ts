/**
 * Readers for the Congreso open-data index pages. They only extract download
 * links and the list of voting days; no other content is read from the HTML.
 */
import * as cheerio from 'cheerio';

export type FileFormat = 'json' | 'csv' | 'xml';

export interface DownloadLink {
  /** Absolute URL. */
  url: string;
  /** File name, e.g. `DiputadosActivos__20261123050006.json`. */
  fileName: string;
  /** Part before `__`, e.g. `DiputadosActivos`. */
  prefix: string;
  /** Generation timestamp in the file name, `yyyymmddhhmmss`. */
  timestamp: string;
  format: FileFormat;
}

const FILE_NAME = /^(?<prefix>[A-Za-z0-9]+)__(?<timestamp>\d{14})\.(?<format>json|csv|xml)$/;

/** Extracts the timestamped data files linked from an index page. */
export function extractDownloadLinks(html: string, baseUrl: string): DownloadLink[] {
  const $ = cheerio.load(html);
  const links = new Map<string, DownloadLink>();
  $('a[href*="/webpublica/opendata/"]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    const url = new URL(href, baseUrl).toString();
    const fileName = decodeURIComponent(url.split('/').pop() ?? '');
    const match = FILE_NAME.exec(fileName);
    if (!match?.groups) return;
    const { prefix, timestamp, format } = match.groups as {
      prefix: string;
      timestamp: string;
      format: FileFormat;
    };
    links.set(url, { url, fileName, prefix, timestamp, format });
  });
  return [...links.values()];
}

/**
 * Picks the link for a dataset prefix following the format preference.
 * If a format appears more than once, the newest timestamp wins.
 */
export function pickDatasetLink(
  links: readonly DownloadLink[],
  prefix: string,
  formatPreference: readonly FileFormat[],
): DownloadLink | undefined {
  for (const format of formatPreference) {
    const candidates = links
      .filter((link) => link.prefix === prefix && link.format === format)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (candidates[0]) return candidates[0];
  }
  return undefined;
}

/**
 * Reads the voting days (`yyyymmdd`) the votaciones index page embeds for its
 * calendar (`var diasVotaciones = [...]`). Returned sorted and without duplicates.
 */
export function extractVotingDays(html: string): string[] {
  const match = /var\s+diasVotaciones\s*=\s*\[([^\]]*)\]/.exec(html);
  if (!match?.[1]) return [];
  const days = match[1]
    .split(',')
    .map((value) => value.trim().replace(/['"]/g, ''))
    .filter((value) => /^\d{8}$/.test(value));
  return [...new Set(days)].sort();
}

export interface SessionZipLink {
  url: string;
  legislatura: number;
  sesion: number;
  /** `yyyymmdd`. */
  fecha: string;
  fileName: string;
}

const SESSION_ZIP =
  /\/webpublica\/opendata\/votaciones\/Leg(?<leg>\d+)\/Sesion(?<sesion>\d+)\/(?<fecha>\d{8})\/(?<file>VOT_\d{14}\.zip)$/;

/** Extracts the per-session ZIP links from a votaciones day page. */
export function extractSessionZips(html: string, baseUrl: string): SessionZipLink[] {
  const $ = cheerio.load(html);
  const zips = new Map<string, SessionZipLink>();
  $('a[href$=".zip"]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    const url = new URL(href, baseUrl);
    const match = SESSION_ZIP.exec(url.pathname);
    if (!match?.groups) return;
    const groups = match.groups as { leg: string; sesion: string; fecha: string; file: string };
    zips.set(url.toString(), {
      url: url.toString(),
      legislatura: Number(groups.leg),
      sesion: Number(groups.sesion),
      fecha: groups.fecha,
      fileName: groups.file,
    });
  });
  return [...zips.values()].sort((a, b) => a.sesion - b.sesion);
}

/** Builds the URL of the votaciones page for one day (`yyyymmdd`). */
export function votingDayUrl(
  baseUrl: string,
  path: string,
  query: Readonly<Record<string, string>>,
  legislaturaRoman: string,
  day: string,
): string {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  url.searchParams.set('targetLegislatura', legislaturaRoman);
  url.searchParams.set('targetDate', `${day.slice(6, 8)}/${day.slice(4, 6)}/${day.slice(0, 4)}`);
  return url.toString();
}
