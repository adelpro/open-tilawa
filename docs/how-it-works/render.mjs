// Renders every sheet in diagrams.html to a PNG, one file per section.
// Usage: node render.mjs [outDir]        (needs playwright installed)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] || here);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1700, height: 1100 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.error('[page]', e.message));

await page.goto('file://' + resolve(here, 'diagrams.html'), { waitUntil: 'load' });
await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 15000 });
await page.evaluate(() => document.fonts && document.fonts.ready);

for (const id of await page.evaluate(() => window.__SHEETS__)) {
  const el = await page.$('[id="' + id + '"]');
  await el.screenshot({ path: resolve(outDir, id + '.png') });
  console.log('→', id + '.png');
}

await browser.close();
