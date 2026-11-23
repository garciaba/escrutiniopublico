/**
 * Checks the built site (web/dist) against the requirements that can be verified
 * without a browser (specification, sections 8 and 9):
 *
 *   pnpm web:build && pnpm web:audit            report problems and exit with 1
 *   pnpm web:audit --strict                     also fail on launch blockers (pending /acerca fields)
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

import { site } from '../../config/site.ts';

const DIST = join(process.cwd(), 'web', 'dist');
const DERIVED = join(process.cwd(), 'data', 'derived');
const HOME_JS_BUDGET = 60_000;
const strict = process.argv.includes('--strict');

const errors: string[] = [];
const warnings: string[] = [];

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

/** File a root-relative link of the site resolves to, as Cloudflare Pages serves it. */
function resolves(href: string): boolean {
  const path = (href.split(/[?#]/)[0] ?? '').replace(/\/$/, '') || '/index';
  return ['', '.html'].some((suffix) => {
    const file = join(DIST, `${path}${suffix}`);
    return existsSync(file) && !readdirSafe(file);
  });
}

function readdirSafe(path: string): boolean {
  try {
    readdirSync(path);
    return true;
  } catch {
    return false;
  }
}

/** JavaScript a page loads: its module scripts and everything they import statically. */
function scriptsOf(html: string): Set<string> {
  const pending = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((match) => match[1] ?? '');
  const seen = new Set<string>();
  while (pending.length > 0) {
    const src = pending.pop() ?? '';
    if (seen.has(src) || !src.startsWith('/')) continue;
    seen.add(src);
    const code = readFileSync(join(DIST, src), 'utf-8');
    for (const match of code.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g)) {
      pending.push(new URL(match[1] ?? '', `https://x${src}`).pathname);
    }
  }
  return seen;
}

if (!existsSync(DIST)) {
  console.error('web/dist does not exist: run `pnpm web:build` first.');
  process.exit(1);
}

const pages = htmlFiles(DIST);
const profiles = pages.filter((page) => relative(DIST, page).startsWith('diputados'));
const footerMarks = ['Fuente:', 'Congreso de los Diputados', 'Última actualización', 'No tiene vinculación'];

for (const page of pages) {
  const name = relative(DIST, page);
  const html = readFileSync(page, 'utf-8');
  const fail = (message: string) => errors.push(`${name}: ${message}`);

  if (!/<html lang="es">/.test(html)) fail('missing lang="es"');
  if (!/<title>[^<]{10,}<\/title>/.test(html)) fail('missing or too short <title>');
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) fail('missing or too short description');
  if (!/<link rel="canonical" href="https:\/\/[^"]+"/.test(html)) fail('missing canonical URL');
  if ((html.match(/<h1[\s>]/g) ?? []).length !== 1) fail('expected exactly one <h1>');

  const footer = html.slice(html.indexOf('<footer'));
  for (const mark of footerMarks) if (!footer.includes(mark)) fail(`footer without «${mark}»`);
  if (!/<time datetime="\d{4}-\d{2}-\d{2}/.test(footer)) fail('footer without the date of the last update');

  // The CSP of public/_headers only allows files of the site.
  if (/<style[\s>]/.test(html)) fail('inline <style>');
  if (/\sstyle="/.test(html)) fail('inline style attribute');
  if (/\son[a-z]+="/.test(html)) fail('inline event handler');
  for (const match of html.matchAll(/<script([^>]*)>/g)) {
    const attributes = match[1] ?? '';
    const data = /type="application\/(ld\+)?json"/.test(attributes);
    if (!data && !/\ssrc="\//.test(attributes)) fail(`inline or external script: <script${attributes}>`);
  }
  if (/(?:src|href)="https?:\/\/(?!escrutiniopublico\.es)[^"]+\.(?:js|css|woff2?|png|jpe?g|svg)"/.test(html)) {
    fail('loads a resource from another origin');
  }

  for (const match of html.matchAll(/\shref="(\/[^"]*)"/g)) {
    const href = match[1] ?? '';
    if (!resolves(href)) fail(`broken internal link ${href}`);
  }
}

// Profiles: one per deputy, without JavaScript, with structured data.
const slugs = readdirSync(join(DERIVED, 'diputados')).filter((file) => file.endsWith('.json'));
if (profiles.length !== slugs.length) {
  errors.push(`expected ${slugs.length} profiles, built ${profiles.length}`);
}
for (const page of profiles) {
  const name = relative(DIST, page);
  const html = readFileSync(page, 'utf-8');
  if (/<script(?![^>]*application\/ld\+json)/.test(html)) errors.push(`${name}: profiles must ship no JavaScript`);
  const jsonLd = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1];
  try {
    const parsed = JSON.parse(jsonLd ?? '') as { mainEntity?: { '@type'?: string; name?: string } };
    if (parsed.mainEntity?.['@type'] !== 'Person' || !parsed.mainEntity.name) throw new Error('no Person');
  } catch {
    errors.push(`${name}: missing or invalid Person structured data`);
  }
  if (!html.includes('class="avatar"')) errors.push(`${name}: missing initials avatar`);
  if (/<img[\s>]/.test(html)) errors.push(`${name}: profiles must not embed photographs`);
}

// Home: complete table without JavaScript, in ranking order, within the JavaScript budget.
const home = readFileSync(join(DIST, 'index.html'), 'utf-8');
const ranking = JSON.parse(readFileSync(join(DERIVED, 'ranking.json'), 'utf-8')) as {
  periodos: { id: string; estado: string }[];
  filas: { periodo: string; situacion: string; posicion: number | null }[];
};
const periodo = ranking.periodos.find((p) => p.estado === 'disponible')?.id;
const expectedRows = ranking.filas.filter((fila) => fila.periodo === periodo && fila.situacion !== 'gobierno');
const body = /<tbody>(.*?)<\/tbody>/s.exec(home)?.[1] ?? '';
const positions = [...body.matchAll(/<td class="c-pos">(\d+)?/g)].map((match) => (match[1] ? Number(match[1]) : null));
if (positions.length !== expectedRows.length) {
  errors.push(`index.html: table has ${positions.length} rows, expected ${expectedRows.length}`);
}
const numbered = positions.filter((position): position is number => position !== null);
if (numbered.some((position, i) => i > 0 && position < (numbered[i - 1] ?? 0))) {
  errors.push('index.html: table is not ordered by position');
}
if (positions.indexOf(null) !== -1 && positions.slice(positions.indexOf(null)).some((position) => position !== null)) {
  errors.push('index.html: rows without position must come last');
}
const homeScripts = scriptsOf(home);
const homeJs = [...homeScripts].reduce((sum, src) => sum + gzipSync(readFileSync(join(DIST, src))).length, 0);
if (homeJs > HOME_JS_BUDGET)
  errors.push(`index.html: ${homeJs} bytes of compressed JavaScript, budget ${HOME_JS_BUDGET}`);
for (const page of pages) {
  if (page !== join(DIST, 'index.html') && scriptsOf(readFileSync(page, 'utf-8')).size > 0) {
    errors.push(`${relative(DIST, page)}: only the home page may load JavaScript`);
  }
}

// Static files every deployment needs.
const sitemap = existsSync(join(DIST, 'sitemap.xml')) ? readFileSync(join(DIST, 'sitemap.xml'), 'utf-8') : '';
const expectedUrls = pages.length - 1; // every page except 404
if ((sitemap.match(/<loc>/g) ?? []).length !== expectedUrls) {
  errors.push(`sitemap.xml: ${(sitemap.match(/<loc>/g) ?? []).length} URLs, expected ${expectedUrls}`);
}
for (const file of ['robots.txt', 'favicon.svg', 'og.png', 'apple-touch-icon.png', '404.html', 'datos/ranking.json']) {
  if (!existsSync(join(DIST, file))) errors.push(`missing ${file}`);
}
if (
  existsSync(join(DIST, 'datos', 'ranking.json')) &&
  readFileSync(join(DIST, 'datos', 'ranking.json'), 'utf-8') !== readFileSync(join(DERIVED, 'ranking.json'), 'utf-8')
) {
  errors.push('datos/ranking.json differs from data/derived/ranking.json');
}
const headers = existsSync(join(DIST, '_headers')) ? readFileSync(join(DIST, '_headers'), 'utf-8') : '';
const csp = /Content-Security-Policy: (.*)/.exec(headers)?.[1] ?? '';
for (const directive of [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'none'",
]) {
  if (!csp.includes(directive)) errors.push(`_headers: Content-Security-Policy without ${directive}`);
}
if (/unsafe-inline|unsafe-eval|\*/.test(csp)) errors.push('_headers: Content-Security-Policy is not strict');

// Launch blocker the owner still has to provide (D-036).
const pending = (['contacto'] as const).filter((field) => !site[field]);
if (pending.length > 0) {
  (strict ? errors : warnings).push(`/acerca still shows as pending: ${pending.join(', ')} (config/site.ts)`);
}

console.log(
  `${pages.length} pages (${profiles.length} profiles) · home JavaScript ${(homeJs / 1000).toFixed(1)} kB gzip in ${homeScripts.size} files · home HTML ${(gzipSync(home).length / 1000).toFixed(1)} kB gzip`,
);
for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length > 0) {
  for (const error of errors.slice(0, 50)) console.error(`error: ${error}`);
  if (errors.length > 50) console.error(`… and ${errors.length - 50} more`);
  process.exit(1);
}
console.log('Audit passed.');
