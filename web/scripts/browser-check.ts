/**
 * Checks the built site in a real browser, served with the production headers:
 *
 *   - axe-core (WCAG 2.2 A and AA rules) on every kind of page, desktop and mobile;
 *   - the ranking list: search, province, filters, sorting, periods, pages, the detail of
 *     a row on a phone and the state in the URL; and the comparison it leads to;
 *   - a profile: tabs, period switch, a metric and its chart, the folded rest of a list,
 *     and the same page without JavaScript;
 *   - the rest of the site: the search box of the header, the glossary, the folded
 *     sections and their anchors, the groups page, and the dark theme;
 *   - privacy and security: no cookies, no storage, no other origins, no CSP violations.
 *
 *   pnpm web:build && pnpm web:check
 *
 * Needs Playwright with a Chromium it can launch. It is not a dependency of the
 * project: the script takes whatever the environment provides.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { site } from '../../config/site.ts';
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
  focus(selector: string): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
  mouse: { move(x: number, y: number): Promise<void> };
  clock: { setFixedTime(time: Date): Promise<void> };
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
/** Deputies the home page shows at a time (decision D-038). */
const PER_PAGE = 10;
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
  '/diputados',
  '/comparar',
  `/comparar?d=${sample.join(',')}`,
  '/grupos',
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

/** Shows every tab and opens every folded block, so that axe sees the whole page. */
const OPEN_EVERYTHING = `document.querySelectorAll('.panel').forEach((panel) => (panel.hidden = false));
  document.querySelectorAll('details').forEach((details) => (details.open = true));`;

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
    if (path !== '/') {
      // Tabs and folded sections hide most of a page: check it again with everything open.
      await page.evaluate(OPEN_EVERYTHING);
      await check(page, `${viewport.name} ${path} (every section open)`);
    }
    if (path === '/') {
      // Everything the visitor can open at once: filters, labels, a row and the tray.
      await page.waitForSelector('#ranking-q:not([disabled])');
      await page.fill('#ranking-q', 'mar');
      await page.click('.barra-filtros');
      await page.selectOption('#ranking-orden', 'indice:desc');
      if (viewport.name === 'mobile') await page.click('#ranking-tabla tbody tr:first-child .abrir');
      await page.click('#ranking-tabla tbody tr:first-child .comparar');
      await check(page, `${viewport.name} ${path} (filtered)`);
    }
    await page.close();
  }
}

// The dark theme follows the system setting: same pages, same rules, other colours.
for (const path of ['/', '/grupos', '/metodologia', ...sample.slice(0, 1).map((slug) => `/diputados/${slug}`)]) {
  const page = await browser.newPage({ viewport: VIEWPORTS[1], bypassCSP: true, colorScheme: 'dark' });
  await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(OPEN_EVERYTHING);
  await check(page, `dark ${path}`);
  await page.close();
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
  /** Rows shown: one page of the list. */
  rows: number;
  /** Deputies that match, as the counter announces. */
  counted: number;
  /** Page marked as current in the pager; 1 when the list fits in one page. */
  current: number;
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
      current: Number(document.querySelector('.paginas [aria-current="page"]')?.textContent ?? 1),
      first: rows[0]?.querySelector('a')?.getAttribute('href') ?? '',
      query: location.search,
      sort: table.querySelector('th[aria-sort]')?.getAttribute('aria-sort') ?? null,
    };
  })()`);
/** Applies a change and checks that the list shows exactly the page the counter and the pager announce. */
async function step(what: string, action: () => Promise<unknown>, query: string): Promise<TableState> {
  await action();
  await page.waitForTimeout(150);
  const state = await tableState();
  expectEqual(`${what}: header rows`, state.headRows, 1);
  const expected = Math.max(0, Math.min(PER_PAGE, state.counted - (state.current - 1) * PER_PAGE));
  expectEqual(`${what}: rows shown vs counted`, state.rows, expected);
  expectEqual(`${what}: URL`, state.query, query);
  return state;
}

await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#ranking-q:not([disabled])');
const initial = await step('initial view', () => Promise.resolve(), '');
expectEqual('the first page has ten deputies', initial.rows, PER_PAGE);
const searched = await step('search', () => page.fill('#ranking-q', 'garcia'), '?q=garcia');
if (searched.counted >= initial.counted)
  expectEqual('search narrows the list', searched.counted, `< ${initial.counted}`);
await page.click('.barra-filtros');
const grouped = await step('group filter', () => page.selectOption('#ranking-grupo', 'GP'), '?q=garcia&grupo=GP');
if (grouped.counted > searched.counted)
  expectEqual('filter narrows the list', grouped.counted, `<= ${searched.counted}`);
const labels = await page.evaluate<string[]>(
  `[...document.querySelectorAll('.estado .chip:not(.todo)')].map((chip) => chip.firstChild.textContent)`,
);
expectEqual('active filters are shown as labels', labels, ['«garcia»', 'Grupo: Popular']);
await step('empty search', () => page.fill('#ranking-q', 'zzzz'), '?q=zzzz&grupo=GP');
await step('remove one label', () => page.click('.estado .chip'), '?grupo=GP');
const cleared = await step('clear filters', () => page.click('.estado .chip'), '');
expectEqual('clear filters restores every deputy', cleared.counted, initial.counted);
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
if (government.counted <= initial.counted) {
  expectEqual('the Government adds deputies', government.counted, `> ${initial.counted}`);
}
await step(
  'another period',
  () => page.check('input[name="ranking-periodo"][value="12m"]'),
  '?periodo=12m&orden=indice&dir=asc&gobierno=1',
);
await step('all labels removed at once', () => page.click('.estado .chip.todo'), '');

// Ten by ten: the pager moves through the list and any other change goes back to the start.
const second = await step('next page', () => page.click('.paginas > button:last-of-type'), '?pagina=2');
expectEqual('the pager marks the second page', second.current, 2);
if (second.first === initial.first) expectEqual('the second page shows other deputies', second.first, 'another');
const lastPage = Math.ceil(initial.counted / PER_PAGE);
const last = await step(
  'last page',
  () => page.click(`.paginas .numero[aria-label="Página ${lastPage}"]`),
  `?pagina=${lastPage}`,
);
expectEqual('the last page holds the rest', last.rows, initial.counted - (lastPage - 1) * PER_PAGE);
const nextDisabled = await page.evaluate<boolean>(`document.querySelector('.paginas > button:last-of-type').disabled`);
expectEqual('no next page after the last', nextDisabled, true);
await step('previous page', () => page.click('.paginas > button:first-of-type'), `?pagina=${lastPage - 1}`);
const province = await step(
  'province',
  () => page.selectOption('#ranking-circunscripcion', 'Madrid'),
  '?circunscripcion=Madrid',
);
expectEqual('a new filter goes back to the first page', province.current, 1);
const places = await page.evaluate<string[]>(
  `[...new Set([...document.querySelectorAll('#ranking-tabla tbody .meta')].map((meta) => meta.textContent.split(' · ').pop()))]`,
);
expectEqual('the province shows only its deputies', places, ['Madrid']);

// A shared link opens on the same view; a page beyond the end becomes the last one.
await page.goto(`${origin}/?periodo=12m&grupo=GS&orden=nombre&pagina=2`, { waitUntil: 'networkidle' });
await page.waitForSelector('#ranking-q:not([disabled])');
const shared = await step('shared link', () => Promise.resolve(), '?periodo=12m&grupo=GS&orden=nombre&pagina=2');
expectEqual('shared link opens on its page', shared.current, 2);
const selected = await page.evaluate<string>(`document.getElementById('ranking-grupo').value`);
expectEqual('shared link fills the controls', selected, 'GS');
await page.goto(`${origin}/?grupo=GS&pagina=999`, { waitUntil: 'networkidle' });
await page.waitForSelector('#ranking-q:not([disabled])');
const beyond = await tableState();
await step('page beyond the end', () => Promise.resolve(), `?grupo=GS&pagina=${Math.ceil(beyond.counted / PER_PAGE)}`);

// Comparison: two deputies chosen in the list travel to the comparison page in the URL.
await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#ranking-q:not([disabled])');
const chosen = await page.evaluate<{ slug: string; indice: string }[]>(
  `[...document.querySelectorAll('#ranking-tabla tbody tr')].slice(0, 2).map((row) => ({
    slug: row.querySelector('a').getAttribute('href').split('/').pop(),
    indice: row.querySelector('.c-ind .valor').textContent,
  }))`,
);
await page.click('#ranking-tabla tbody tr:nth-child(1) .comparar');
const alone = await page.evaluate<number>(`document.querySelectorAll('.bandeja a').length`);
expectEqual('one deputy alone cannot be compared', alone, 0);
await page.click('#ranking-tabla tbody tr:nth-child(2) .comparar');
await page.click('.bandeja a');
await page.waitForSelector('#comparacion');
const compared = await page.evaluate<{ query: string; indices: string[] }>(
  `({
    query: location.pathname + location.search,
    indices: [...document.querySelectorAll('#comparacion .principal .valor')].map((cell) => cell.textContent),
  })`,
);
expectEqual('comparison URL', compared.query, `/comparar?d=${chosen.map((d) => d.slug).join(',')}`);
expectEqual(
  'comparison shows the same indices as the list',
  compared.indices,
  chosen.map((d) => d.indice),
);
await page.fill('#comparar-q', 'garcia');
await page.waitForSelector('.sugerencias button');
await page.click('.sugerencias button');
await page.waitForTimeout(150);
const three = await page.evaluate<{ columns: number; full: boolean; slugs: number }>(
  `({
    columns: document.querySelectorAll('#comparacion thead th').length,
    full: document.getElementById('comparar-q').disabled,
    slugs: new URLSearchParams(location.search).get('d').split(',').length,
  })`,
);
expectEqual('a third deputy can be added, and no more', three, { columns: 3, full: true, slugs: 3 });
await page.click('#comparacion thead .chip');
await page.waitForTimeout(150);
const two = await page.evaluate<number>(`document.querySelectorAll('#comparacion thead th').length`);
expectEqual('a deputy can be removed from the comparison', two, 2);

// On a phone each deputy takes one line; a tap opens the dimensions.
const phone = await browser.newContext({ viewport: VIEWPORTS[1] });
const phonePage = await phone.newPage();
await phonePage.goto(`${origin}/`, { waitUntil: 'networkidle' });
await phonePage.waitForSelector('#ranking-q:not([disabled])');
const shownDimensions = () =>
  phonePage.evaluate<number>(
    `[...document.querySelectorAll('#ranking-tabla tbody tr:first-child .c-dim')].filter((cell) => cell.offsetParent !== null).length`,
  );
expectEqual('phone: dimensions folded at first', await shownDimensions(), 0);
await phonePage.click('#ranking-tabla tbody tr:first-child .abrir');
const opened = await shownDimensions();
if (opened === 0) expectEqual('phone: a tap opens the dimensions', opened, '> 0');
const pressed = await phonePage.evaluate<string | null>(
  `document.querySelector('#ranking-tabla tbody tr:first-child .abrir').getAttribute('aria-expanded')`,
);
expectEqual('phone: the open state is announced', pressed, 'true');
const overflow = await phonePage.evaluate<boolean>(`document.documentElement.scrollWidth > window.innerWidth`);
expectEqual('phone: no horizontal scroll', overflow, false);
// The folded rest of a list in a profile takes the width of its card (a style of the
// home page once squeezed it into a circle).
const folded = sample[0];
if (folded) {
  await phonePage.goto(`${origin}/diputados/${folded}`, { waitUntil: 'networkidle' });
  // Every tab open, so that each folded list has a size to measure.
  const widths = await phonePage.evaluate<number[]>(
    `(() => {
      document.querySelectorAll('.panel').forEach((panel) => (panel.hidden = false));
      return [...document.querySelectorAll('details.mas')].map((rest) => Math.round(rest.getBoundingClientRect().width));
    })()`,
  );
  if (widths.length === 0) expectEqual('phone: the sample profile has a folded list', widths.length, '> 0');
  if (widths.some((width) => width < 250))
    expectEqual('phone: folded lists of a profile span the card', widths, '>= 250 each');
}
await phone.close();

// Profile: the sections are tabs, the period is a switch, a metric opens on its chart.
const profile = sample[0] ?? '';
const profileState = () =>
  page.evaluate<{ shown: string[]; selected: string | null; address: string; periods: number }>(
    `({
      shown: [...document.querySelectorAll('.ficha .panel')].filter((panel) => !panel.hidden).map((panel) => panel.id),
      selected: document.querySelector('.pestanas [aria-selected="true"]')?.getAttribute('href') ?? null,
      address: location.pathname + location.hash,
      periods: [...document.querySelectorAll('#resumen .per')].filter((block) => block.offsetParent !== null).length,
    })`,
  );
await page.goto(`${origin}/diputados/${profile}`, { waitUntil: 'networkidle' });
await page.waitForSelector('.ficha.con-pestanas');
expectEqual('profile: opens on the summary, one period', await profileState(), {
  shown: ['resumen'],
  selected: '#resumen',
  address: `/diputados/${profile}`,
  periods: 1,
});
await page.click('.pestanas a[href="#actividad"]');
expectEqual('profile: a tab shows its section and nothing else', await profileState(), {
  shown: ['actividad'],
  selected: '#actividad',
  address: `/diputados/${profile}#actividad`,
  periods: 0,
});
await page.focus('.pestanas a[href="#actividad"]');
await page.keyboard.press('ArrowRight');
expectEqual('profile: the arrow keys move between tabs', (await profileState()).shown, ['votaciones']);
await page.keyboard.press('Home');
expectEqual('profile: Home goes back to the first tab', (await profileState()).address, `/diputados/${profile}`);

const periodsOffered = await page.evaluate<number>(`document.querySelectorAll('input[name="ficha-periodo"]').length`);
if (periodsOffered > 1) {
  const firstIndex = await page.evaluate<string>(
    `document.querySelector('#resumen .per-1 .indice-cifra .valor')?.textContent ?? ''`,
  );
  await page.check('input[name="ficha-periodo"]:not(:checked)');
  const switched = await page.evaluate<{ first: boolean; second: boolean }>(
    `({
      first: document.querySelector('#resumen .per-1').offsetParent !== null,
      second: document.querySelector('#resumen .per-2').offsetParent !== null,
    })`,
  );
  expectEqual('profile: the period switch swaps the figures', switched, { first: false, second: true });
  await page.check('input[name="ficha-periodo"]');
  const back = await page.evaluate<string>(
    `[...document.querySelectorAll('#resumen .per')].find((block) => block.offsetParent !== null)?.querySelector('.indice-cifra .valor')?.textContent ?? ''`,
  );
  expectEqual('profile: and back', back, firstIndex);
} else {
  expectEqual('profile: the sample has two periods to switch between', periodsOffered, '> 1');
}

await page.click('.pestanas a[href="#actividad"]');
const metric = '#actividad .per-1 .grupo-dimension:nth-of-type(2) .linea';
const closed = await page.evaluate<boolean>(`!document.querySelector('${metric} .linea-cuerpo').checkVisibility()`);
expectEqual('profile: a metric is one line until it is opened', closed, true);
await page.click(`${metric} summary`);
const chart = await page.evaluate<{ x: number; y: number; width: number; height: number; rest: string }>(
  `(() => {
    const svg = document.querySelector('${metric} svg.chispa');
    svg.scrollIntoView({ block: 'center' });
    const box = svg.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height, rest: document.querySelector('${metric} .chispa-lectura').textContent };
  })()`,
);
await page.mouse.move(chart.x + chart.width * 0.5, chart.y + chart.height / 2);
const reading = await page.evaluate<string>(`document.querySelector('${metric} .chispa-lectura').textContent`);
if (reading === chart.rest || !/^[a-z]+ de \d{4}: /.test(reading)) {
  expectEqual('profile: the chart names the month under the pointer', reading, 'a month and its value');
}
const lit = await page.evaluate<number>(`document.querySelectorAll('${metric} svg.chispa rect.activa').length`);
if (lit > 1) expectEqual('profile: one column at most is highlighted', lit, '<= 1');

await page.click('.pestanas a[href="#votaciones"]');
const votes = () =>
  page.evaluate<number>(
    `[...document.querySelectorAll('#votaciones tbody tr')].filter((row) => row.checkVisibility()).length`,
  );
expectEqual('profile: five votes at first', await votes(), 5);
await page.click('#votaciones details.mas summary');
if ((await votes()) <= 5) expectEqual('profile: the rest of the votes opens', await votes(), '> 5');

// A link to a section opens on its tab.
await page.goto(`${origin}/diputados/${profile}#intervenciones`, { waitUntil: 'networkidle' });
await page.waitForSelector('.ficha.con-pestanas');
expectEqual('profile: a link to a section opens its tab', (await profileState()).shown, ['intervenciones']);

// Without JavaScript the profile is the same content, one section after another.
const plain = await browser.newContext({ viewport: VIEWPORTS[1], javaScriptEnabled: false });
const plainPage = await plain.newPage();
await plainPage.goto(`${origin}/diputados/${profile}`, { waitUntil: 'load' });
const sections = await plainPage.evaluate<string[]>(
  `[...document.querySelectorAll('.ficha .panel')].filter((panel) => panel.offsetParent !== null).map((panel) => panel.id)`,
);
expectEqual('profile without JavaScript: every section is on the page', sections.slice(0, 4), [
  'resumen',
  'actividad',
  'votaciones',
  'intervenciones',
]);
await plain.close();

// The rest of the site. The header offers a search box everywhere but on the home page.
await page.goto(`${origin}/metodologia`, { waitUntil: 'networkidle' });
await page.waitForSelector('#buscador-q');
await page.fill('#buscador-q', 'garcia');
await page.waitForSelector('#buscador-lista a');
const found = await page.evaluate<{ links: string[]; names: string[] }>(
  `({
    links: [...document.querySelectorAll('#buscador-lista a')].map((link) => link.getAttribute('href')),
    names: [...document.querySelectorAll('#buscador-lista .nombre')].map((name) => name.textContent),
  })`,
);
if (found.links.length === 0 || found.links.length > 6 || found.links.some((link) => !link.startsWith('/diputados/'))) {
  expectEqual('header search: up to six links to profiles', found.links, 'profiles');
}
if (found.names.some((name) => !/garc[ií]a/i.test(name))) {
  expectEqual('header search: every suggestion matches', found.names, 'names with «garcía»');
}
await page.keyboard.press('Enter');
await page.waitForSelector('.ficha');
const landed = await page.evaluate<string>('location.pathname');
expectEqual('header search: Enter opens the first suggestion', landed, found.links[0]);
await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
const onHome = await page.evaluate<number>(`document.querySelectorAll('[data-buscador], #buscador-q').length`);
expectEqual('header search: not on the home page, which is itself a search', onHome, 0);

// A term of the glossary opens its definition.
await page.goto(`${origin}/diputados/${profile}#actividad`, { waitUntil: 'networkidle' });
await page.waitForSelector('.ficha.con-pestanas');
await page.click('.leyenda-metricas .termino');
const defined = await page.evaluate<boolean>(`document.getElementById('glosa-percentil').matches(':popover-open')`);
expectEqual('glossary: a term opens its definition', defined, true);
await page.keyboard.press('Escape');

// Text pages: one section open, the rest folded; a link to an anchor opens its section.
await page.goto(`${origin}/metodologia`, { waitUntil: 'networkidle' });
const sectionsOpen = await page.evaluate<{ open: string[]; total: number; loose: number }>(
  `({
    open: [...document.querySelectorAll('details.acordeon[open]')].map((section) => section.id),
    total: document.querySelectorAll('details.acordeon').length,
    loose: [...document.querySelectorAll('.prosa > *')].filter((block) => !block.matches('details.acordeon')).length,
  })`,
);
expectEqual('methodology: only the summary is open', sectionsOpen.open, ['resumen']);
if (sectionsOpen.total < 8) expectEqual('methodology: its sections fold', sectionsOpen.total, '>= 8');
expectEqual('methodology: nothing is left outside the sections', sectionsOpen.loose, 0);
for (const [anchor, section] of [
  ['agregados', 'agregados'],
  ['dimension-debates', 'dimensiones'],
] as const) {
  await page.goto(`${origin}/metodologia#${anchor}`, { waitUntil: 'networkidle' });
  const opened = await page.evaluate<boolean>(`document.getElementById('${section}').open`);
  expectEqual(`methodology: a link to #${anchor} opens its section`, opened, true);
}

// Groups: one metric at a time, and a strip names the deputy under the pointer.
await page.goto(`${origin}/grupos`, { waitUntil: 'networkidle' });
const cardsShown = () =>
  page.evaluate<string[]>(
    `[...document.querySelectorAll('.vista-periodos .panel:nth-of-type(1) .metricas > .metrica')].filter((card) => card.offsetParent !== null).map((card) => card.querySelector('h3').textContent)`,
  );
const firstCard = await cardsShown();
expectEqual('groups: one metric card at a time', firstCard.length, 1);
await page.check('.vista-periodos .panel:nth-of-type(1) .metricas-vista label:nth-of-type(3) input');
const thirdCard = await cardsShown();
expectEqual('groups: the switch still shows one card', thirdCard.length, 1);
if (thirdCard[0] === firstCard[0]) expectEqual('groups: the switch changes the card', thirdCard[0], 'another metric');
const stillPeriod = await page.evaluate<number>(
  `[...document.querySelectorAll('.vista-periodos > .panel')].filter((panel) => panel.offsetParent !== null).length`,
);
expectEqual('groups: choosing a metric does not hide the period', stillPeriod, 1);
const strip = await page.evaluate<{ x: number; y: number; width: number; height: number }>(
  `(() => {
    const svg = document.querySelector('.vista-periodos .panel:nth-of-type(1) .dist-fila:nth-child(2) svg.dist-franja');
    svg.scrollIntoView({ block: 'center' });
    const box = svg.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  })()`,
);
await page.mouse.move(strip.x + strip.width * 0.5, strip.y + strip.height / 2);
const named = await page.evaluate<{ href: string; lit: number }>(
  `({
    href: document.querySelector('.vista-periodos .panel:nth-of-type(1) .dist-lectura a')?.getAttribute('href') ?? '',
    lit: document.querySelectorAll('.vista-periodos .panel:nth-of-type(1) .raya.activa').length,
  })`,
);
if (!named.href.startsWith('/diputados/'))
  expectEqual('groups: a strip links to the deputy under the pointer', named.href, 'a profile');
expectEqual('groups: one tick is highlighted', named.lit, 1);

// Stale-data warning (specification, section 6): the browser compares the date of the
// last run with its own clock and warns after the configured number of hours.
const { ejecutado } = JSON.parse(readFileSync(join(process.cwd(), 'data', 'derived', 'meta.json'), 'utf-8')) as {
  ejecutado: string;
};
for (const [hours, visible] of [
  [1, false],
  [site.horasDatosAntiguos + 1, true],
] as const) {
  const clockContext = await browser.newContext({ viewport: VIEWPORTS[0] });
  const clockPage = await clockContext.newPage();
  await clockPage.clock.setFixedTime(new Date(Date.parse(ejecutado) + hours * 3_600_000));
  await clockPage.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await clockPage.waitForSelector('#ranking-q:not([disabled])');
  const shown = await clockPage.evaluate<boolean>(`!document.querySelector('.ranking-app > .aviso').hidden`);
  expectEqual(`stale-data warning ${hours} h after the last run`, shown, visible);
  await clockContext.close();
}

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
  `${paths.length} pages × ${VIEWPORTS.length} viewports with axe-core (light and dark), interactions on every kind of page and privacy: ${failures} problems`,
);
process.exit(failures > 0 ? 1 : 0);
