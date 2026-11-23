/**
 * Minimal static server for web/dist that behaves like Cloudflare Pages where it
 * matters for local checks: extensionless URLs, 404.html and the response headers of
 * public/_headers (so the Content-Security-Policy is exercised before deploying).
 *
 *   pnpm web:preview [port]
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { gzipSync } from 'node:zlib';

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

interface HeaderRule {
  pattern: RegExp;
  headers: Record<string, string>;
}

/** Parses the subset of the _headers format the site uses: a path with `*` wildcards and indented headers. */
export function parseHeaders(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const pattern = line
        .trim()
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      rules.push({ pattern: new RegExp(`^${pattern}$`), headers: {} });
      continue;
    }
    const separator = line.indexOf(':');
    const rule = rules[rules.length - 1];
    if (rule && separator > 0) rule.headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return rules;
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

export function serve(root: string, port: number): Promise<Server> {
  const rules = isFile(join(root, '_headers')) ? parseHeaders(readFileSync(join(root, '_headers'), 'utf-8')) : [];
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const base = join(root, normalize(path));
    const candidates = path.endsWith('/') ? [join(base, 'index.html')] : [base, `${base}.html`];
    const found = base.startsWith(root) ? candidates.find(isFile) : undefined;
    const file = found ?? join(root, '404.html');
    if (!isFile(file)) {
      response.writeHead(404).end('Not found');
      return;
    }
    const headers: Record<string, string> = {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    };
    for (const rule of rules) if (rule.pattern.test(path)) Object.assign(headers, rule.headers);
    // Plain HTTP on localhost: the upgrade directive would break every request.
    if (headers['Content-Security-Policy']) {
      headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace(
        /;\s*upgrade-insecure-requests/,
        '',
      );
    }
    let body: Buffer = readFileSync(file);
    const compressible = /text|json|svg|xml|javascript/.test(headers['Content-Type'] ?? '');
    if (compressible && /\bgzip\b/.test(String(request.headers['accept-encoding'] ?? ''))) {
      body = gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
    }
    response.writeHead(found ? 200 : 404, headers).end(body);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1]?.endsWith('serve.ts')) {
  const dist = join(process.cwd(), 'web', 'dist');
  if (!existsSync(dist)) {
    console.error('web/dist does not exist: run `pnpm web:build` first.');
    process.exit(1);
  }
  const port = Number(process.argv[2] ?? 4321);
  await serve(dist, port);
  console.log(`Serving web/dist at http://127.0.0.1:${port}`);
}
