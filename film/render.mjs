#!/usr/bin/env node
/* Frame-exact renderer for the launch film. Plain HTML pages that expose
 * window.__seek(t) and window.__duration are captured with Playwright and encoded
 * with ffmpeg. No build step.
 *
 *   node render.mjs --page index32.html --mode waves --audio audio/mix32.wav --out final-32-waves.mp4
 *   node render.mjs --page index.html --mode bars --stills 0.6,7.4,13.0 --out-dir stills
 *
 * Motion blur: a 180 degree shutter (an exposure of half a frame) averaged from
 * three captures, taken only on frames where a tracked element actually moves by
 * more than BLUR_PX within the exposure. Static frames take one capture.
 *
 * Needs: node, playwright (chromium), ffmpeg.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, linkSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

/* a global install is only visible to require(); a local one to both */
const { chromium } = await (async () => {
  try { return createRequire(import.meta.url)('playwright'); } catch { return await import('playwright'); }
})();

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const PAGE = arg('page', 'index.html');
const MODE = arg('mode', 'bars');
const OUT = arg('out', null);
const AUDIO = arg('audio', null);
const STILLS = arg('stills', null);
const OUT_DIR = arg('out-dir', 'stills');
const WORKERS = Number(arg('workers', '2'));
const FPS = 30;
const BLUR_PX = 1.5;
const SHUTTER = 1 / 60;          // 180 degrees at 30 fps
const FRAME_LIMIT = arg('frames', null);   // "a:b", for tests
const KEEP = arg('keep', null);

const url = pathToFileURL(path.resolve(PAGE)).href + `?mode=${MODE}`;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => typeof window.__seek === 'function');
  await page.evaluate(src => { window.__snap = new Function('return (' + src + ')')(); }, snapshot.toString());
  return page;
}

/* the boxes that can move: camera, docked panels, the page column, the arrow, the mark */
function snapshot() {
  return [...document.querySelectorAll('.cam,.panel,.col,.cursor,.mark,.modal')]
    .filter(e => getComputedStyle(e).display !== 'none')
    .map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
}

async function movement(page, t) {
  const a = await page.evaluate(x => { window.__seek(x); return window.__snap(); }, Math.max(0, t - SHUTTER / 2));
  const b = await page.evaluate(x => { window.__seek(x); return window.__snap(); }, t + SHUTTER / 2);
  if (a.length !== b.length) return Infinity;
  let m = 0;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < 4; j++) m = Math.max(m, Math.abs(a[i][j] - b[i][j]));
  return m;
}

async function shot(page, t, file) {
  await page.evaluate(x => window.__seek(x), t);
  await page.screenshot({ path: file, type: 'jpeg', quality: 95 });
}

const browser = await chromium.launch();

if (STILLS) {
  mkdirSync(OUT_DIR, { recursive: true });
  const page = await openPage(browser);
  for (const t of STILLS.split(',').map(Number)) {
    await page.evaluate(x => window.__seek(x), t);
    await page.screenshot({ path: path.join(OUT_DIR, `${MODE}-${path.basename(PAGE, '.html')}-${t.toFixed(2)}.png`) });
  }
  await browser.close();
  process.exit(0);
}

if (!OUT) { console.error('--out is required'); process.exit(1); }

const probe = await openPage(browser);
const DURATION = await probe.evaluate(() => window.__duration);
let first = 0, last = Math.round(DURATION * FPS);
if (FRAME_LIMIT) [first, last] = FRAME_LIMIT.split(':').map(Number);
const total = last - first;
const dir = KEEP || path.join('/tmp', `film-frames-${path.basename(OUT, '.mp4')}`);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const pages = [probe];
for (let i = 1; i < WORKERS; i++) pages.push(await openPage(browser));

let done = 0, blurred = 0;
const started = Date.now();
await Promise.all(pages.map(async (page, w) => {
  for (let f = first + w; f < last; f += WORKERS) {
    const t = f / FPS;
    const base = (f - first) * 3;
    const name = n => path.join(dir, String(base + n).padStart(6, '0') + '.jpg');
    const moving = (await movement(page, t)) > BLUR_PX;
    if (moving) {
      blurred++;
      const offs = [-SHUTTER / 2, 0, SHUTTER / 2];
      for (let k = 0; k < 3; k++) await shot(page, Math.max(0, t + offs[k]), name(k));
    } else {
      await shot(page, t, name(0));
      try { linkSync(name(0), name(1)); linkSync(name(0), name(2)); }
      catch { copyFileSync(name(0), name(1)); copyFileSync(name(0), name(2)); }
    }
    if (++done % 60 === 0) {
      const s = (Date.now() - started) / 1000;
      console.log(`${done}/${total} frames, ${blurred} blurred, ${s.toFixed(0)} s, eta ${(s / done * (total - done)).toFixed(0)} s`);
    }
  }
}));
await browser.close();

/* three captures per frame at 90 fps -> average each triple -> 30 fps */
const args = ['-y', '-loglevel', 'error', '-framerate', '90', '-i', path.join(dir, '%06d.jpg')];
if (AUDIO) args.push('-i', AUDIO);
args.push('-vf', "tmix=frames=3:weights='1 1 1',select='eq(mod(n,3),2)',setpts=N/(30*TB),format=yuv420p",
  '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart');
if (AUDIO) args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(total / FPS));
args.push(OUT);
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.status !== 0) { console.error('ffmpeg failed'); process.exit(1); }
if (!KEEP) rmSync(dir, { recursive: true, force: true });
console.log(`wrote ${OUT}: ${total} frames, ${blurred} with motion blur, ${((Date.now() - started) / 1000).toFixed(0)} s`);
