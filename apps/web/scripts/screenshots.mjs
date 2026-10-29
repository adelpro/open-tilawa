#!/usr/bin/env node
/**
 * Capture the install prompt's screenshots.
 *
 *   node scripts/screenshots.mjs
 *   SCREENSHOT_URL=http://127.0.0.1:4173 node scripts/screenshots.mjs
 *
 * It shoots the **deployed** site, not the working tree: real catalogue, real
 * torrent, real audio, so the spectrum ribbon is the one a listener sees. Run it
 * after a release, not before one — a screenshot must never show a branch that
 * is not shipped. Point `SCREENSHOT_URL` at a preview only if that preview can
 * reach the catalogue and the `/media` web seed, or every shot will show the
 * "could not play" state.
 *
 * Playwright is not a dependency: a browser in `npm ci` costs ~100 MB and this
 * repo's tests are deliberately pure node. Install it where you run this, or
 * point `PLAYWRIGHT_MODULE` at an existing copy:
 *
 *   npm i -g playwright && npx playwright install chromium
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/screenshots.mjs
 *
 * The viewport is fixed, so the PNG's pixels match the `sizes` strings in
 * `src/constants/pwa.ts`; `test/pwa-manifest.test.ts` fails if they drift.
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'screenshots');
const SITE = process.env.SCREENSHOT_URL ?? 'https://tilawah.cc';
const MODULE = process.env.PLAYWRIGHT_MODULE ?? 'playwright';

/** `require.resolve` understands a directory and a package name; `import` alone does neither. */
async function loadPlaywright() {
  const { createRequire } = await import('node:module');
  const { pathToFileURL } = await import('node:url');
  const entry = createRequire(import.meta.url).resolve(MODULE);
  return import(pathToFileURL(entry).href);
}

const playwright = await loadPlaywright().catch((error) => {
  console.error(`Cannot load ${MODULE}: ${error.message}\n  npm i -g playwright && npx playwright install chromium`);
  process.exit(1);
});

// A CJS build puts the named exports under `default`.
const chromium = playwright.chromium ?? playwright.default?.chromium;
if (!chromium) {
  console.error(`${MODULE} has no chromium export.`);
  process.exit(1);
}

/** Headless shell first, then the installed Chrome. */
async function launch() {
  try {
    return await chromium.launch();
  } catch (error) {
    if (!/Executable doesn't exist/.test(error.message)) throw error;
    return chromium.launch({ channel: 'chrome' });
  }
}

/** What the listener chose last time: the locale, the palette, the pin. */
const state = (theme) =>
  JSON.stringify({
    version: 3,
    reciterId: 1,
    lastSurahId: 1,
    positions: {},
    settings: { locale: 'ar', theme, rate: 1 },
    updatedAt: Date.now(),
  });

const shots = [
  { file: 'player-narrow.png', viewport: { width: 360, height: 640 }, scale: 3, theme: 'light', hash: '#/', play: true },
  { file: 'reciters-narrow.png', viewport: { width: 360, height: 640 }, scale: 3, theme: 'light', hash: '#/', act: 'reciters' },
  { file: 'settings-narrow-dark.png', viewport: { width: 360, height: 640 }, scale: 3, theme: 'dark', hash: '#/settings', gate: 'settings' },
  { file: 'player-wide.png', viewport: { width: 1280, height: 720 }, scale: 1.5, theme: 'light', hash: '#/', play: true, pinned: true },
  { file: 'settings-wide.png', viewport: { width: 1280, height: 720 }, scale: 1.5, theme: 'light', hash: '#/settings', pinned: true, gate: 'settings' },
];

mkdirSync(OUT, { recursive: true });

const browser = await launch();

try {
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: shot.viewport,
      deviceScaleFactor: shot.scale,
      locale: 'ar',
      colorScheme: shot.theme,
    });

    await context.addInitScript(
      ({ blob, pin }) => {
        try {
          localStorage.setItem('open-tilawa:v3', blob);
          localStorage.setItem('tilawa.pinned.v1', pin ? '1' : '0');
          // The keyboard hint is a one-time toast; a store shot should not be
          // its first screenshot.
          localStorage.setItem('tilawa.keys.v1', 'seen');
        } catch {
          // A fresh profile with storage blocked still renders; it just forgets.
        }
      },
      { blob: state(shot.theme), pin: Boolean(shot.pinned) },
    );

    const page = await context.newPage();

    // A screen is ready when its data is. The player waits for the catalogue —
    // until it answers there is no reciter and the roster is an error box — and
    // the settings page waits for its own copy, since it never asks for the
    // roster at all.
    const ready =
      shot.gate === 'settings'
        ? page.getByText('المظهر').first().waitFor({ timeout: 20_000 })
        : page.waitForResponse(
            (response) => response.url().includes('/api/public/reciters') && response.ok(),
            { timeout: 20_000 },
          );

    await page.goto(`${SITE}/${shot.hash}`, { waitUntil: 'domcontentloaded' });
    await ready;

    if (shot.act === 'reciters') {
      // A phone opens the roster from the footer's reciter row; the top bar's
      // copy of that button is desktop-only.
      await page.getByRole('button', { name: /اختيار القارئ/ }).click();
      await page.getByPlaceholder('ابحث باسم القارئ').waitFor({ timeout: 5_000 });
      await page.waitForTimeout(700);
    } else if (shot.play) {
      // Metadata, then a real press: the ribbon is drawn from the audio, so a
      // screenshot without playback is a flat line.
      await page.waitForTimeout(6_000);
      await page.getByRole('button', { name: 'تشغيل' }).click();
      await page.waitForTimeout(5_000);
    } else {
      await page.waitForTimeout(700);
    }

    const file = path.join(OUT, shot.file);
    await page.screenshot({ path: file });

    const size = await page.evaluate(
      () => `${Math.round(window.innerWidth * devicePixelRatio)}x${Math.round(window.innerHeight * devicePixelRatio)}`,
    );
    console.log(`${shot.file}  ${size}`);

    await context.close();
  }

  console.log(`\nWrote ${shots.length} screenshots to public/screenshots/`);
} finally {
  await browser.close();
}
