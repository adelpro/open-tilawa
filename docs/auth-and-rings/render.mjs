// Renders the two sheets in `sheet.html` to PNG, one file per sheet.
// Usage: node render.mjs            (needs playwright; `npx playwright install chromium` once)
//        node render.mjs --full     also writes the whole page, title block included
import { chromium } from 'playwright';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const full = process.argv.includes('--full');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('[page]', e.message));

await page.goto('file://' + resolve(here, 'sheet.html'), { waitUntil: 'load' });
await page.waitForFunction(() => document.fonts && document.fonts.status === 'loaded');
await page.evaluate(() => document.fonts.ready);

const sheets = await page.$$('.sheetwrap');
for (const [i, sheet] of sheets.entries()) {
  const file = resolve(here, `0${i + 1}-${i === 0 ? 'ring-and-sync' : 'linking-and-auth'}.png`);
  await sheet.screenshot({ path: file });
  console.log('→', file.replace(here + '/', ''));
}

if (full) {
  const file = resolve(here, 'full-sheet.png');
  await page.screenshot({ path: file, fullPage: true });
  console.log('→ full-sheet.png');
}

await browser.close();
