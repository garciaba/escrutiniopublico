/**
 * Checks the built site (web/dist) against the requirements that can be verified
 * without a browser (specification, sections 8 and 9):
 *
 *   pnpm web:build && pnpm web:audit            report problems and exit with 1
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = join(process.cwd(), 'web', 'dist');
const DERIVED = join(process.cwd(), 'data', 'derived');
const HOME_JS_BUDGET = 60_000;
/** Deputies the home page shows at a time (decision D-038). */
const PER_PAGE = 10;
/** Pages that run the ranking's JavaScript: the home page and the comparison. */
const INTERACTIVE = ['index.html', 'comparar.html'];
/**
 * Every other page is complete without JavaScript. What they load only improves them
 * (the search box of the header, tabs, read-outs of the charts), so it stays tiny:
 * compressed bytes for a plain page and for a page with a script of its own.
 */
const PLAIN_JS_BUDGET = 2_500;
const PROFILE_JS_BUDGET = 5_000;
const WITH_OWN_SCRIPT = ['grupos.html'];
const PROFILE_SECTIONS = ['resumen', 'actividad', 'votaciones', 'intervenciones'];
/** Pages left out of the sitemap: the error page and the comparison, which is noindex (D-040). */
const NOT_IN_SITEMAP = ['404.html', 'comparar.html'];

const errors: string[] = [];

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
const profiles = pages.filter((page) => relative(DIST, page).startsWith(`diputados${sep}`));
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

type JsonLdNode = Record<string, unknown>;

/** Every node of the JSON-LD blocks of a page, with the contents of @graph flattened. */
function structuredData(html: string): JsonLdNode[] {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap((match) => {
    try {
      const parsed = JSON.parse(match[1] ?? '') as JsonLdNode;
      return Array.isArray(parsed['@graph']) ? (parsed['@graph'] as JsonLdNode[]) : [parsed];
    } catch {
      return [];
    }
  });
}

// Profiles: one per deputy, complete without JavaScript, with structured data.
const slugs = readdirSync(join(DERIVED, 'diputados')).filter((file) => file.endsWith('.json'));
if (profiles.length !== slugs.length) {
  errors.push(`expected ${slugs.length} profiles, built ${profiles.length}`);
}
for (const page of profiles) {
  const name = relative(DIST, page);
  const html = readFileSync(page, 'utf-8');
  const weight = [...scriptsOf(html)].reduce((sum, src) => sum + gzipSync(readFileSync(join(DIST, src))).length, 0);
  if (weight > PROFILE_JS_BUDGET) {
    errors.push(`${name}: ${weight} bytes of compressed JavaScript, budget ${PROFILE_JS_BUDGET}`);
  }
  for (const section of PROFILE_SECTIONS) {
    if (!html.includes(`id="${section}"`)) errors.push(`${name}: section «${section}» is not in the HTML`);
  }
  if (/<section[^>]*\shidden/.test(html)) errors.push(`${name}: a section is hidden without JavaScript`);
  const nodes = structuredData(html);
  const person = nodes.find((node) => node['@type'] === 'ProfilePage')?.mainEntity as JsonLdNode | undefined;
  if (person?.['@type'] !== 'Person' || !person.name || !person.description) {
    errors.push(`${name}: missing or invalid Person structured data`);
  }
  if (!nodes.some((node) => node['@type'] === 'BreadcrumbList')) errors.push(`${name}: missing breadcrumbs`);
  if (/\((?:La|Las|El|Los|A|As|O|Os|Illes)\)/.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) {
    errors.push(`${name}: a constituency is written in the official inverted form`);
  }
  if (!html.includes('class="ficha-resumen"')) errors.push(`${name}: missing the summary sentence`);
  if (!html.includes('class="avatar"')) errors.push(`${name}: missing initials avatar`);
  if (/<img[\s>]/.test(html)) errors.push(`${name}: profiles must not embed photographs`);
}

// Home: the first ten without JavaScript, in ranking order, within the JavaScript budget.
// The complete list, with the members of the Government at the end, is a plain page.
const home = readFileSync(join(DIST, 'index.html'), 'utf-8');
const ranking = JSON.parse(readFileSync(join(DERIVED, 'ranking.json'), 'utf-8')) as {
  periodos: { id: string; estado: string }[];
  filas: { periodo: string; situacion: string; posicion: number | null }[];
};
const periodo = ranking.periodos.find((p) => p.estado === 'disponible')?.id;
const ofPeriod = ranking.filas.filter((fila) => fila.periodo === periodo);
const ranked = ofPeriod.filter((fila) => fila.situacion !== 'gobierno');

function checkTable(name: string, html: string, expected: number): void {
  const body = /<tbody>(.*?)<\/tbody>/s.exec(html)?.[1] ?? '';
  const positions = [...body.matchAll(/<td class="c-pos">(\d+)?/g)].map((match) =>
    match[1] ? Number(match[1]) : null,
  );
  if (positions.length !== expected) errors.push(`${name}: table has ${positions.length} rows, expected ${expected}`);
  const numbered = positions.filter((position): position is number => position !== null);
  if (numbered.some((position, i) => i > 0 && position < (numbered[i - 1] ?? 0))) {
    errors.push(`${name}: table is not ordered by position`);
  }
  const firstEmpty = positions.indexOf(null);
  if (firstEmpty !== -1 && positions.slice(firstEmpty).some((position) => position !== null)) {
    errors.push(`${name}: rows without position must come last`);
  }
}

checkTable('index.html', home, Math.min(PER_PAGE, ranked.length));
if (!home.includes('href="/diputados"')) errors.push('index.html: no link to the complete list');
const completeList = join(DIST, 'diputados.html');
if (existsSync(completeList)) checkTable('diputados.html', readFileSync(completeList, 'utf-8'), ofPeriod.length);
else errors.push('missing diputados.html');
const homeScripts = scriptsOf(home);
const homeJs = [...homeScripts].reduce((sum, src) => sum + gzipSync(readFileSync(join(DIST, src))).length, 0);
for (const page of pages) {
  const name = relative(DIST, page);
  const scripts = scriptsOf(readFileSync(page, 'utf-8'));
  const budget = INTERACTIVE.includes(name)
    ? HOME_JS_BUDGET
    : profiles.includes(page) || WITH_OWN_SCRIPT.includes(name)
      ? PROFILE_JS_BUDGET
      : PLAIN_JS_BUDGET;
  const weight = [...scripts].reduce((sum, src) => sum + gzipSync(readFileSync(join(DIST, src))).length, 0);
  if (weight > budget) errors.push(`${name}: ${weight} bytes of compressed JavaScript, budget ${budget}`);
}

// Structured data of the home page and of the data page (D-040).
const homeNodes = structuredData(home);
if (!homeNodes.some((node) => node['@type'] === 'WebSite')) errors.push('index.html: missing WebSite structured data');
if (!homeNodes.some((node) => node['@type'] === 'Organization')) {
  errors.push('index.html: missing Organization structured data');
}
const dataPage = join(DIST, 'datos.html');
const dataset = existsSync(dataPage)
  ? structuredData(readFileSync(dataPage, 'utf-8')).find((node) => node['@type'] === 'Dataset')
  : undefined;
if (!dataset?.license || !Array.isArray(dataset.distribution) || dataset.distribution.length === 0) {
  errors.push('datos.html: missing or incomplete Dataset structured data');
}
if (!/<meta name="robots" content="noindex"/.test(readFileSync(join(DIST, 'comparar.html'), 'utf-8'))) {
  errors.push('comparar.html: must be noindex');
}

// Static files every deployment needs.
const sitemap = existsSync(join(DIST, 'sitemap.xml')) ? readFileSync(join(DIST, 'sitemap.xml'), 'utf-8') : '';
const expectedUrls = pages.filter((page) => !NOT_IN_SITEMAP.includes(relative(DIST, page))).length;
if ((sitemap.match(/<loc>/g) ?? []).length !== expectedUrls) {
  errors.push(`sitemap.xml: ${(sitemap.match(/<loc>/g) ?? []).length} URLs, expected ${expectedUrls}`);
}
// A date of change is never later than the last calculation, and every profile has one.
const calculated = (JSON.parse(readFileSync(join(DERIVED, 'meta.json'), 'utf-8')) as { fecha_calculo: string })
  .fecha_calculo;
for (const [, loc, lastmod] of sitemap.matchAll(/<loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)) {
  if (lastmod && lastmod > calculated) errors.push(`sitemap.xml: ${loc} changed on ${lastmod}, after ${calculated}`);
  if (!lastmod && loc?.includes('/diputados/')) errors.push(`sitemap.xml: ${loc} has no date of change`);
}
for (const file of [
  'robots.txt',
  'favicon.svg',
  'og.png',
  'apple-touch-icon.png',
  '404.html',
  'grupos.html',
  'comparar.html',
  'buscador.json',
  'datos/ranking.json',
  'datos/grupos.json',
]) {
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

console.log(
  `${pages.length} pages (${profiles.length} profiles) · home JavaScript ${(homeJs / 1000).toFixed(1)} kB gzip in ${homeScripts.size} files · home HTML ${(gzipSync(home).length / 1000).toFixed(1)} kB gzip`,
);
if (errors.length > 0) {
  for (const error of errors.slice(0, 50)) console.error(`error: ${error}`);
  if (errors.length > 50) console.error(`… and ${errors.length - 50} more`);
  process.exit(1);
}
console.log('Audit passed.');
