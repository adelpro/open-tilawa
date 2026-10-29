#!/usr/bin/env node
/**
 * Render both banners from `docs/` into the web app's `public/`, at 1280x640.
 *
 *   node docs/banner-render.mjs
 *
 * Two files, one layout: `banner.html` (English, LTR) and `banner-ar.html`
 * (Arabic, RTL). The output lives in `apps/web/public/`, so the same file is on
 * GitHub (README) and served at https://tilawah.cc/banner.png — one copy, two
 * doors.
 *
 * Shot at 2x, so the type is crisp and the phone screenshot is not resampled
 * twice. Same Playwright rules as apps/web/scripts/screenshots.mjs: no
 * dependency, `PLAYWRIGHT_MODULE` to point at an existing copy.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, '..', 'apps', 'web', 'public');
const MODULE = process.env.PLAYWRIGHT_MODULE ?? 'playwright';

const BANNERS = [
  { html: 'banner.html', out: 'banner.png' },
  { html: 'banner-ar.html', out: 'banner-ar.png' },
];

async function loadPlaywright() {
  const { createRequire } = await import('node:module');
  const entry = createRequire(import.meta.url).resolve(MODULE);
  return import(pathToFileURL(entry).href);
}

const playwright = await loadPlaywright().catch((error) => {
  console.error(`Cannot load ${MODULE}: ${error.message}\n  npm i -g playwright && npx playwright install chromium`);
  process.exit(1);
});

const chromium = playwright.chromium ?? playwright.default?.chromium;

let browser;
try {
  browser = await chromium.launch();
} catch (error) {
  if (!/Executable doesn't exist/.test(error.message)) throw error;
  browser = await chromium.launch({ channel: 'chrome' });
}

try {
  for (const banner of BANNERS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(path.join(DIR, banner.html)).href, { waitUntil: 'load' });
    // Fonts and the phone capture are local; `load` covers both, the tick covers the ribbon script.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);

    await page.screenshot({ path: path.join(OUT, banner.out) });
    console.log(`apps/web/public/${banner.out}  (2560x1280 source; display at 1280x640)`);
    await page.close();
  }
} finally {
  await browser.close();
}
