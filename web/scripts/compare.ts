/**
 * Compares screenshots of the same pages from two builds of the site, on a phone and
 * on a desktop, and lists the pages that differ. It is how a change of styles is
 * checked not to reach pages it should not touch (the automatic checks do not look at
 * how a page looks):
 *
 *   pnpm web:compare <dist A> <dist B> [path ...]
 *
 * Without paths it compares one page of each kind. Exits with 1 when a page differs
 * and writes both screenshots under .comparacion/. Needs Playwright, like web:check.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

import { serve } from './serve.ts';

interface Page {
  goto(url: string, options?: object): Promise<unknown>;
  screenshot(options: object): Promise<Buffer>;
  close(): Promise<void>;
}
interface Browser {
  newPage(options: object): Promise<Page>;
  close(): Promise<void>;
}

const DEFAULT_PATHS = [
  '/',
  '/diputados',
  '/comparar',
  '/grupos',
  '/metodologia',
  '/datos',
  '/cambios',
  '/acerca',
  '/404',
];
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];
const OUT = join(process.cwd(), '.comparacion');

const [a, b, ...given] = process.argv.slice(2);
if (!a || !b) {
  console.error('Usage: pnpm web:compare <dist A> <dist B> [path ...]');
  process.exit(2);
}
const paths = given.length > 0 ? given : DEFAULT_PATHS;

let chromium: { launch(): Promise<Browser> };
try {
  ({ chromium } = createRequire(import.meta.url)('playwright') as { chromium: { launch(): Promise<Browser> } });
} catch {
  console.error('Playwright is not available in this environment; install it to compare screenshots.');
  process.exit(2);
}

const servers = [await serve(resolve(a), 0), await serve(resolve(b), 0)];
const origins = servers.map((server) => {
  const address = server.address();
  return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});
const browser = await chromium.launch();
let different = 0;

for (const viewport of VIEWPORTS) {
  for (const path of paths) {
    const shots: Buffer[] = [];
    for (const origin of origins) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      await page.goto(`${origin}${path}`, { waitUntil: 'networkidle' });
      shots.push(await page.screenshot({ fullPage: true }));
      await page.close();
    }
    const [first, second] = shots;
    const same = first !== undefined && second !== undefined && first.equals(second);
    if (!same && first && second) {
      different += 1;
      mkdirSync(OUT, { recursive: true });
      const name = `${path.replace(/[^a-z0-9]+/gi, '_') || '_'}-${viewport.name}`;
      writeFileSync(join(OUT, `${name}-A.png`), first);
      writeFileSync(join(OUT, `${name}-B.png`), second);
    }
    console.log(`${same ? 'same     ' : 'DIFFERENT'} ${viewport.name.padEnd(7)} ${path}`);
  }
}

await browser.close();
for (const server of servers) server.close();
console.log(
  `${different} of ${paths.length * VIEWPORTS.length} screenshots differ${different > 0 ? `; see ${OUT}` : ''}`,
);
process.exit(different > 0 ? 1 : 0);
