/**
 * Latest commits that changed the normalized tables, for /cambios (specification,
 * section 6: the git history of data/normalized is the auditable change log). Read at
 * build time; empty when git or the history is not available.
 */
import { execFileSync } from 'node:child_process';

export interface CommitDatos {
  sha: string;
  fecha: string;
  asunto: string;
}

export function parseGitLog(output: string): CommitDatos[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha = '', fecha = '', ...asunto] = line.split('\t');
      return { sha, fecha, asunto: asunto.join('\t') };
    })
    .filter((commit) => /^[0-9a-f]{40}$/.test(commit.sha) && /^\d{4}-\d{2}-\d{2}$/.test(commit.fecha));
}

export function commitsDeDatos(limite: number): CommitDatos[] {
  try {
    const output = execFileSync(
      'git',
      ['log', `-n${limite}`, '--date=short', '--format=%H%x09%cd%x09%s', '--', 'data/normalized'],
      { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return parseGitLog(output);
  } catch {
    return [];
  }
}
