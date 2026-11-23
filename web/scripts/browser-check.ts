/**
 * Checks the built site in a real browser, served with the production headers:
 *
 *   - axe-core (WCAG 2.2 A and AA rules) on every kind of page, desktop and mobile;
 *   - the ranking table: search, filters, sorting, periods and the state in the URL;
 *   - privacy and security: no cookies, no storage, no other origins, no CSP violations.
 *
 *   pnpm web:build && pnpm web:check
 *
 * Needs Playwright with a Chromium it can launch. It is not a dependency of the
 * project: the script takes whatever the environment provides.
 */
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { serve } from './serve.ts';

interface AxeNode {
  target: string[];
  failureSummary?: string;
}
interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: AxeNode[];
}
interface Page {
  goto(url: string, options?: object): Promise<unknown>;
  addScriptTag(options: { path: string }): Promise<unknown>;
  evaluate<T>(script: string): Promise<T>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  check(selector: string): Promise<void>;
  selectOption(selector: string, value: string): Promise<unknown>;
  waitForSelector(selector: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  on(event: string, listener: (payload: { type(): string; text(): string; url(): string }) => void): void;
  close(): Promise<void>;
}
interface Context {
  newPage(): Promise<Page>;
  cookies(): Promise<unknown[]>;
  close(): Promise<void>;
}
interface Browser {
  newPage(options: object): Promise<Page>;
  newContext(options?: object): Promise<Context>;
  close(): Promise<void>;
}

const require = createRequire(import.meta.url);
const DIST = join(process.cwd(), 'web', 'dist');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

if (!existsSync(DIST)) {
  console.error('web/dist does not exist: run `pnpm web:build` first.');
  process.exit(1);
}

let chromium: { launch(): Promise<Browser> };
try {
  ({ chromium } = require('playwright') as { chromium: { launch(): Promise<Browser> } });
} catch {
  console.error('Playwright is not available in this environment; install it to run the accessibility check.');
  process.exit(1);
}

// A profile of each kind: ranked, member of the Government and too few days in the period.
const profiles = readdirSync(join(DIST, 'diputados')).map((file) => file.replace(/\.html$/, ''));
const sample = [profiles[0], 'oscar-puente-santiago', 'meritxell-batet-lamana'].filter(
  (slug): slug is string => slug !== undefined && profiles.includes(slug),
);
const paths = [
  '/',
  '/metodologia',
  '/datos',
  '/cambios',
  '/acerca',
  '/404',
  ...sample.map((slug) => `/diputados/${slug}`),
];

const server = await serve(DIST, 0);
const address = server.address();
const origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
const browser = await chromium.launch();
let failures = 0;

async function check(page: Page, label: string): Promise<void> {
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const violations = await page.evaluate<AxeViolation[]>(
    `axe.run(document, { runOnly: { type: 'tag', values: ${JSON.stringify(TAGS)} } }).then((r) => r.violations)`,
  );
  for (const violation of violations) {
    failures += 1;
    console.error(`${label}: [${violation.impact ?? 'n/a'}] ${violation.id}: ${violation.help}`);
    for (const node of violation.nodes.slice(0, 3)) console.error(`    ${node.target.join(' ')}`);
  }
}

for (const viewport of VIEWPORTS) {
  for (const path of paths) {
    // The policy of _headers would block the injected axe script; it is checked separately.
    const page = await browser.newPage({ viewport, bypassCSP: true });
    await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
    await check(page, `${viewport.name} ${path}`);
    if (path === '/') {
      await page.waitForSelector('#ranking-q:not([disabled])');
      await page.fill('#ranking-q', 'mar');
      await page.selectOption('#ranking-orden', 'indice:desc');
      await check(page, `${viewport.name} ${path} (filtered)`);
    }
    await page.close();
  }
}

// Ranking table, with the Content-Security-Policy of _headers in force.
const context = await browser.newContext({ viewport: VIEWPORTS[0] });
const page = await context.newPage();
const consoleErrors: string[] = [];
const origins = new Set<string>();
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('request', (request) => origins.add(new URL(request.url()).origin));

function expectEqual(what: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  failures += 1;
  console.error(`ranking: ${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

interface TableState {
  headRows: number;
  rows: number;
  counted: number;
  first: string;
  query: string;
  sort: string | null;
}
const tableState = (): Promise<TableState> =>
  page.evaluate<TableState>(`(() => {
    const table = document.getElementById('ranking-tabla');
    const rows = [...table.querySelectorAll('tbody tr')].filter((row) => !row.querySelector('.vacio'));
    return {
      headRows: table.querySelectorAll('thead tr').length,
      rows: rows.length,
      counted: Number(document.querySelector('.recuento strong').textContent.replace(/[^0-9]/g, '')),
      first: rows[0]?.querySelector('a')?.getAttribute('href') ?? '',
      query: location.search,
      sort: table.querySelector('th[aria-sort]')?.getAttribute('aria-sort') ?? null,
    };
  })()`);
/** Applies a change and checks that the table shows exactly the rows the counter announces. */
async function step(what: string, action: () => Promise<unknown>, query: string): Promise<TableState> {
  await action();
  await page.waitForTimeout(150);
  const state = await tableState();
  expectEqual(`${what}: header rows`, state.headRows, 1);
  expectEqual(`${what}: rows shown vs counted`, state.rows, state.counted);
  expectEqual(`${what}: URL`, state.query, query);
  return state;
}

await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#ranking-q:not([disabled])');
const initial = await step('initial view', () => Promise.resolve(), '');
const searched = await step('search', () => page.fill('#ranking-q', 'garcia'), '?q=garcia');
if (searched.rows >= initial.rows) expectEqual('search narrows the table', searched.rows, `< ${initial.rows}`);
const grouped = await step('group filter', () => page.selectOption('#ranking-grupo', 'GP'), '?q=garcia&grupo=GP');
if (grouped.rows > searched.rows) expectEqual('filter narrows the table', grouped.rows, `<= ${searched.rows}`);
await step('empty search', () => page.fill('#ranking-q', 'zzzz'), '?q=zzzz&grupo=GP');
const cleared = await step('clear filters', () => page.click('.controles-pie button'), '');
expectEqual('clear filters restores every row', cleared.rows, initial.rows);
expectEqual('clear filters restores the order', cleared.first, initial.first);
const byIndex = await step('sort by a header', () => page.click('th.c-ind button'), '?orden=indice');
expectEqual('sorted column is announced', byIndex.sort, 'descending');
const reversed = await step('reverse the sort', () => page.click('th.c-ind button'), '?orden=indice&dir=asc');
expectEqual('reversed column is announced', reversed.sort, 'ascending');
const government = await step(
  'include the Government',
  () => page.check('.casilla input'),
  '?orden=indice&dir=asc&gobierno=1',
);
if (government.rows <= initial.rows) expectEqual('the Government adds rows', government.rows, `> ${initial.rows}`);
await step(
  'another period',
  () => page.check('input[name="ranking-periodo"][value="12m"]'),
  '?periodo=12m&orden=indice&dir=asc&gobierno=1',
);

// A shared link opens on the same view.
await page.goto(`${origin}/?periodo=12m&grupo=GS&orden=nombre`, { waitUntil: 'networkidle' });
await page.waitForSelector('#ranking-q:not([disabled])');
await step('shared link', () => Promise.resolve(), '?periodo=12m&grupo=GS&orden=nombre');
const selected = await page.evaluate<string>(`document.getElementById('ranking-grupo').value`);
expectEqual('shared link fills the controls', selected, 'GS');

// Privacy and security.
for (const path of paths) await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
const stored = await page.evaluate<number>('localStorage.length + sessionStorage.length + document.cookie.length');
expectEqual('cookies', await context.cookies(), []);
expectEqual('browser storage', stored, 0);
expectEqual('origins contacted', [...origins], [origin]);
expectEqual('console errors (CSP violations included)', consoleErrors, []);
await context.close();

await browser.close();
server.close();
console.log(
  `${paths.length} pages × ${VIEWPORTS.length} viewports with axe-core, ranking interactions and privacy: ${failures} problems`,
);
process.exit(failures > 0 ? 1 : 0);
