/**
 * Store screenshots, composed rather than raw.
 *
 * Both stores want 1280×800. A bare crop of the popup or a full page is not a
 * store image; these put each view in a browser-like frame on the site's paper,
 * with one Arabic headline above it, in the site's own tokens.
 *
 * Usage: npm run store-shots  (needs a build in .output/chrome-mv3)
 */

import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { chromium } from 'playwright';

const EXTENSION = join(process.cwd(), '.output/chrome-mv3');
const OUT = join(process.cwd(), 'store', 'screens');

const INK = '#111111';
const MUTED = '#6b6b6b';
const LINE = '#e8e8e8';
const PAPER = '#fbfaf8';
const SURFACE = '#ffffff';
const WAVE = '#1c4d78';

const FRAMES = [
  { file: 'welcome', hash: '#/welcome', title: 'مرحبًا', sub: 'شاشة أول تشغيل: ماذا تحفظ، وما تكلفته، وكيف تتوقّف' },
  { file: 'reciters', hash: '#/reciters', title: 'اختر ما تحفظه', sub: 'قائمة كاملة بالقرّاء، وحجم كل تلاوة قبل تنزيلها، وما تتابعه من استماعك' },
  { file: 'settings', hash: '#/settings', title: 'تحكّم كامل', sub: 'أنماط الحفظ الثلاثة، وحدّ المساحة، والمواعيد التي تسمح فيها بالمشاركة' },
  { file: 'about', hash: '#/about', title: 'خصوصية بلا حساب', sub: 'لا معرّف دائم، ولا إحصاءات، ولا قراءة لصفحاتك' },
];

const CAIRO = `data:font/woff2;base64,${readFileSync('public/fonts/cairo-600.woff2').toString('base64')}`;

const card = ({ title, sub, shot }) => `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face { font-family: 'Cairo'; font-weight: 600; src: url(${CAIRO}) format('woff2'); }
      * { box-sizing: border-box; }
      html { overflow: hidden; }
      *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
      body {
        margin: 0; width: 1280px; height: 800px; padding: 56px 64px;
        background: ${PAPER};
        font-family: 'Cairo', 'Noto Naskh Arabic', system-ui, sans-serif;
        color: ${INK};
        display: grid; grid-template-rows: auto 1fr;
        gap: 28px;
      }
      .head { display: flex; align-items: baseline; gap: 16px; }
      h1 { margin: 0; font-size: 40px; font-weight: 600; letter-spacing: -0.01em; }
      p { margin: 0; color: ${MUTED}; font-size: 19px; }
      .rule { flex: 1; height: 1px; background: ${LINE}; }
      .window {
        background: ${SURFACE}; border: 1px solid ${LINE}; border-radius: 10px;
        overflow: hidden; box-shadow: 0 24px 48px -32px rgba(17,17,17,.32);
        display: grid; grid-template-rows: 34px 1fr;
      }
      .bar { display: flex; align-items: center; gap: 8px; padding: 0 14px; border-bottom: 1px solid ${LINE}; }
      .dot { width: 9px; height: 9px; border-radius: 50%; background: ${LINE}; }
      .url {
        margin-inline-start: 12px; font-size: 12px; color: ${MUTED};
        border: 1px solid ${LINE}; border-radius: 999px; padding: 2px 12px;
      }
      .body { overflow: hidden; }
      .body img { display: block; width: 100%; }
      .accent { position: absolute; inset-block-start: 0; inset-inline-start: 0; width: 6px; height: 100%; background: ${WAVE}; }
      .frame { position: relative; }
    </style>
  </head>
  <body>
    <div class="head">
      <h1>${title}</h1>
      <span class="rule"></span>
      <p>${sub}</p>
    </div>
    <div class="frame">
      <div class="accent"></div>
      <div class="window">
        <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="url">رفيق تلاوة</span></div>
        <div class="body"><img src="data:image/png;base64,${shot}" /></div>
      </div>
    </div>
  </body>
</html>`;

const main = async () => {
  mkdirSync(OUT, { recursive: true });

  const profile = mkdtempSync(join(tmpdir(), 'tilawah-store-'));
  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: { width: 1180, height: 720 },
    locale: 'ar-SA',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, '--no-first-run'],
  });

  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20_000 });
    const id = new URL(worker.url()).host;

    const page = await context.newPage();
    const composer = await context.newPage();
    await composer.setViewportSize({ width: 1280, height: 800 });

    for (const frame of FRAMES) {
      await page.goto(`chrome-extension://${id}/options.html${frame.hash}`);
      await page.waitForSelector('.masthead', { timeout: 20_000 });
      if (frame.file === 'reciters') {
        await page.waitForSelector('ul.roster li', { timeout: 20_000 });
        const add = page.locator('details.group').nth(1).locator('ul.roster li button.action');
        await add.nth(0).click();
        await add.nth(1).click();
        await page.waitForTimeout(300);
      }
      if (frame.file === 'about') {
        await page.evaluate(() => document.querySelectorAll('details.doc').forEach((node) => (node.open = true)));
      }

      await page.addStyleTag({
        content:
          'html,body{overflow:hidden!important}' +
          '*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}' +
          // The fixed summary bar is chrome of the app, not content: on a store
          // asset it only appears as a sliced strip at the frame's bottom edge.
          '.bar{display:none!important}',
      });

      // The settings story is the mode cards and the disk budget; scroll past
      // the masthead so both sit inside the frame.
      if (frame.file === 'settings') await page.evaluate(() => window.scrollTo(0, 300));

      const shot = await page.screenshot({
        type: 'png',
        animations: 'disabled',
        // 680 of the 720 viewport: the page paints a horizontal scrollbar in
        // its last ~20px, and a sliced scrollbar is not a store asset.
        clip: { x: 0, y: 0, width: 1180, height: 680 },
      });
      await composer.setContent(card({ ...frame, shot: shot.toString('base64') }), { waitUntil: 'load' });
      await composer.evaluate(() => document.fonts.ready);
      const name = `${frame.file}-1280x800.png`;
      await composer.screenshot({ path: join(OUT, name) });
      console.log(`store-shots: ${name}`);
    }

    // Promo tile (440×280, Chrome small promo + AMO) and marquee (1400×560, optional).
    const banner = (width, height, size) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
      @font-face{font-family:'Cairo';font-weight:600;src:url(${CAIRO}) format('woff2')}
      *{box-sizing:border-box}
      body{margin:0;width:${width}px;height:${height}px;background:${INK};color:${PAPER};
        font-family:'Cairo',system-ui,sans-serif;display:grid;place-items:center;position:relative;overflow:hidden}
      .wave{position:absolute;inset-block-end:-40%;inset-inline-start:-10%;width:80%;height:80%;
        border-radius:50%;background:${WAVE};opacity:.55}
      .inner{position:relative;display:flex;align-items:center;gap:${Math.round(size * 0.28)}px;padding:0 ${Math.round(size * 0.35)}px}
      img{width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.22)}px;background:${WAVE}}
      h1{margin:0;font-size:${Math.round(size * 0.44)}px;line-height:1.15}
      p{margin:${Math.round(size * 0.1)}px 0 0;font-size:${Math.round(size * 0.2)}px;color:#c9d3dc}
    </style></head><body><div class="wave"></div><div class="inner">
      <img src="data:image/png;base64,${readFileSync('store/icon-128.png').toString('base64')}" alt="">
      <div><h1>رفيق تلاوة</h1><p>القرآن أقرب إليك</p></div>
    </div></body></html>`;

    for (const [name, width, height, size] of [
      ['promo-440x280.png', 440, 280, 96],
      ['marquee-1400x560.png', 1400, 560, 180],
    ]) {
      await composer.setViewportSize({ width, height });
      await composer.setContent(banner(width, height, size), { waitUntil: 'load' });
      await composer.evaluate(() => document.fonts.ready);
      await composer.screenshot({ path: join(OUT, name) });
      console.log(`store-shots: ${name}`);
    }
  } finally {
    await context.close();
  }
};

main().then(
  () => console.log('store-shots: done'),
  (error) => {
    console.error(`store-shots: FAILED — ${error.message}`);
    process.exit(1);
  },
);
