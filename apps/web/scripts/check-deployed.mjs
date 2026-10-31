#!/usr/bin/env node
/**
 * What a deploy must still do, checked against the deployed site.
 *
 *   node scripts/check-deployed.mjs
 *   CHECK_URL=http://127.0.0.1:8099 node scripts/check-deployed.mjs
 *
 * Two things it proves, both of which shipped broken at least once:
 *
 * 1. **A `/listen/<reciter>/<surah>` link plays that surah.** For a while it played
 *    Al-Fatihah in whichever reciter was stored: the deep link set the reciter and the
 *    surah, and the player's boot step overwrote both. Reading the screen did not show
 *    it — the title was right in the tab only after hydration — so this waits for the
 *    `<audio>` element and reads the file it actually chose.
 *
 * 2. **The sitemap is the one the router would write.** Every listed page has its
 *    language twin and the three `hreflang` alternates, and the pages it lists answer
 *    200. A sitemap that lists a 404 is worse than a short one.
 *
 * Playwright is not a dependency (see scripts/screenshots.mjs for the same rule):
 *   npm i -g playwright && npx playwright install chromium
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/check-deployed.mjs
 *
 * Exit code 0 means every check passed; anything else prints what failed and exits 1.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const SITE = (process.env.CHECK_URL ?? 'https://tilawah.cc').replace(/\/$/, '');
const CATALOGUE = process.env.CHECK_CATALOGUE ?? 'https://console.tilawah.cc';
const MODULE = process.env.PLAYWRIGHT_MODULE ?? 'playwright';

/** Surahs the check opens; 1 is the control, 18 and 36 are what a stale restore shows. */
const SURAHS = [1, 18, 36];
/** The name segment the hub actually links with; the number alone must work too. */
const CANONICAL = { 1: '1-al-fatihah', 18: '18-al-kahf', 36: '36-ya-sin' };
/** Releases checked: the first two the catalogue lists, so the check follows the roster. */
const RELEASES = 2;
/** How long a cold player may take to put a file behind `<audio>`. */
const AUDIO_TIMEOUT = 25_000;

const failures = [];
const fail = (message) => {
  failures.push(message);
  console.error(`  FAIL  ${message}`);
};
const pass = (message) => console.log(`  ok    ${message}`);

async function loadPlaywright() {
  const entry = createRequire(import.meta.url).resolve(MODULE);
  const loaded = await import(pathToFileURL(entry).href);
  // A CommonJS build exposes `chromium` on `default`, not on the namespace.
  return loaded.chromium ? loaded : loaded.default;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The catalogue is the only source of releases; the check follows it, not a fixture. */
async function roster() {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${CATALOGUE}/api/public/reciters?page=1&range=20`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    // Public endpoints rate-limit; a release check that fails on the third run in a
    // minute would teach everyone to ignore it.
    if (response.status === 429 && attempt < 3) {
      await sleep(attempt * 2000);
      continue;
    }
    if (!response.ok) throw new Error(`catalogue answered ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.reciters) || body.reciters.length === 0) {
      throw new Error('catalogue returned no releases');
    }
    return body.reciters.filter((release) => release.slug && release.infohash);
  }
}

/**
 * The number in `…/webtorrent/<hash>/<folder>/018.mp3`, whatever the padding.
 *
 * The catalogue names the file; comparing numbers rather than strings is what keeps
 * this honest when a release pads differently from its neighbour.
 */
function surahInSrc(src) {
  if (!src) return null;
  const file = src.split('?')[0].split('/').pop() ?? '';
  const match = /^0*(\d{1,3})\.mp3$/i.exec(file);
  return match ? Number(match[1]) : null;
}

async function checkListenLinks(browser, catalogue) {
  console.log('\nlisten links');
  const context = await browser.newContext();
  const cases = [];
  for (const release of catalogue.slice(0, RELEASES)) {
    for (const surah of SURAHS) {
      // The named form is what the hub links with; the bare number below it is the
      // second form the router accepts, and `/listen/...` is served by the app either way.
      cases.push({ release, surah, path: `/listen/${release.slug}/${CANONICAL[surah]}` });
    }
  }
  const first = catalogue[0];
  cases.push({ release: first, surah: 18, path: `/listen/${first.slug}/18` });

  for (const { release, surah, path } of cases) {
    const page = await context.newPage();
    const label = `${path.replace(`/listen/${release.slug}`, release.slug)} (surah ${surah})`;
    try {
      await page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      // `src` is set only once a file exists for the chosen surah, which is the whole
      // point: a stale restore leaves the first surah's file there instead.
      await page.waitForFunction(
        () => {
          const audio = document.querySelector('audio');
          return Boolean(audio && audio.getAttribute('src'));
        },
        undefined,
        { timeout: AUDIO_TIMEOUT },
      );
      const seen = await page.evaluate(() => {
        const audio = document.querySelector('audio');
        return {
          src: audio ? audio.getAttribute('src') : null,
          path: location.pathname,
          title: document.title,
        };
      });

      const played = surahInSrc(seen.src);
      if (played !== surah) fail(`${label}: plays surah ${played ?? 'none'} (${seen.src})`);
      else if (!seen.src.includes(`/${release.infohash}/`)) {
        fail(`${label}: played another release (${seen.src})`);
      } else pass(`${label}: ${seen.title} — ${seen.src.split('/').pop()}`);
    } catch (error) {
      fail(`${label}: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
    } finally {
      await page.close();
    }
  }

  await context.close();
}

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

async function checkSitemap(catalogue) {
  console.log('\nsitemap');
  const response = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) return fail(`sitemap answered ${response.status}`);

  const xml = await response.text();
  const urls = locs(xml);
  if (urls.length === 0) return fail('sitemap lists nothing');
  if (!xml.includes('xmlns:xhtml=')) fail('sitemap has no xhtml namespace, so alternates are invisible');

  const alternates = [...xml.matchAll(/<xhtml:link[^>]*hreflang="([a-z-]+)"[^>]*href="([^"]+)"/g)];
  if (alternates.length !== urls.length * 3) {
    fail(`${urls.length} URLs carry ${alternates.length} alternates, expected ${urls.length * 3}`);
  } else pass(`${urls.length} URLs, 3 alternates each`);

  // Both languages of every page, and each one pointing at the same pair. The home
  // page is the exception that proves the rule: its twin is `/en`, not `/en/`.
  const set = new Set(urls);
  const twinOf = (url) => {
    const path = url.slice(SITE.length) || '/';
    return path === '/' ? `${SITE}/en` : `${SITE}/en${path}`;
  };
  const missingTwin = urls
    .filter((url) => !(url === `${SITE}/en` || url.startsWith(`${SITE}/en/`)))
    .map(twinOf)
    .filter((twin) => !set.has(twin));
  if (missingTwin.length > 0) fail(`${missingTwin.length} Arabic URLs have no English twin, e.g. ${missingTwin[0]}`);
  else pass('every Arabic URL has its English twin');

  // The pages the release is about, named explicitly: a sitemap can be well formed and
  // still be the one from three releases ago.
  const hubs = ['/', '/about', '/privacy', '/reciters', `/reciters/${catalogue[0].slug}`];
  for (const path of hubs) {
    if (!set.has(`${SITE}${path}`)) fail(`missing ${path} in the sitemap`);
    if (!set.has(twinOf(`${SITE}${path}`))) fail(`missing the English twin of ${path} in the sitemap`);
  }

  // A sitemap that lists a 404 is worse than a short one. Sample rather than hammer:
  // every eighth URL plus both forms of each hub page.
  const sample = [
    ...new Set([
      ...urls.filter((_, index) => index % 8 === 0),
      ...hubs.flatMap((path) => [`${SITE}${path}`, twinOf(`${SITE}${path}`)]),
    ]),
  ];
  let broken = 0;
  for (const url of sample) {
    const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!head || head.status !== 200) {
      broken += 1;
      fail(`${url} answered ${head ? head.status : 'no response'}`);
    }
  }
  if (broken === 0) pass(`${sample.length} sampled URLs answer 200`);
}

const playwright = await loadPlaywright().catch((error) => {
  console.error(`Cannot load ${MODULE}: ${error.message}\n  npm i -g playwright && npx playwright install chromium`);
  process.exit(1);
});

const catalogue = await roster().catch((error) => {
  console.error(`check-deployed: ${error.message}`);
  process.exit(1);
});

console.log(`check-deployed: ${SITE}`);
/**
 * A browser that exists. The Playwright download is often missing or out of step with
 * the package (see the same note in screenshots.mjs), and a system Chrome is the same
 * engine; `CHROME_PATH` decides when neither default is right.
 */
const executablePath =
  process.env.CHROME_PATH ?? (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await playwright.chromium.launch(executablePath ? { executablePath } : {});
try {
  await checkListenLinks(browser, catalogue);
  await checkSitemap(catalogue);
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(`\ncheck-deployed: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\ncheck-deployed: CLEAN');
