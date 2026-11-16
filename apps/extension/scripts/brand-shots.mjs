/**
 * Branding pass on the capture-flow slides, and the light banners.
 *
 * capture-flow composes the frame and the headline; it has no slot for a logo or
 * a URL. This adds the lockup — the wave tile and `tilawah.cc` — in the slide's
 * own margin, plus the two banners the stores ask for, on paper instead of ink.
 *
 * Run after `capture-flow build`:
 *   node scripts/brand-shots.mjs
 */

import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright';

const SLIDES = join(process.cwd(), 'store', 'screens', 'cf', 'mac-1280', 'ar-SA');
const OUT = join(process.cwd(), 'store', 'screens');
const BRANDED = join(OUT, 'branded');

const INK = '#111111';
const MUTED = '#6b6b6b';
const PAPER = '#fbfaf8';
const WAVE = '#1c4d78';

const CAIRO = `data:font/woff2;base64,${readFileSync('public/fonts/cairo-600.woff2').toString('base64')}`;
const ICON = `data:image/png;base64,${readFileSync('store/icon-128.png').toString('base64')}`;

const page = (body, extra = '') => `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
  @font-face{font-family:'Cairo';font-weight:600;src:url(${CAIRO}) format('woff2')}
  *{box-sizing:border-box}
  body{margin:0;font-family:'Cairo',system-ui,sans-serif;color:${INK}}
  .lockup{position:absolute;display:flex;align-items:center;gap:8px;
    font-size:15px;font-weight:600;color:${MUTED};direction:ltr}
  .lockup img{width:22px;height:22px;border-radius:5px}
  ${extra}
</style></head><body>${body}</body></html>`;

const main = async () => {
  mkdirSync(BRANDED, { recursive: true });

  const browser = await chromium.launch();
  const frame = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // 1. The capture-flow slides, with the lockup in the lower margin.
  for (const file of readdirSync(SLIDES).filter((name) => name.endsWith('.png')).sort()) {
    const shot = readFileSync(join(SLIDES, file)).toString('base64');
    await frame.setContent(
      page(
        `<img src="data:image/png;base64,${shot}" style="position:absolute;inset:0;width:1280px;height:800px">
         <div class="lockup" style="inset-block-end:26px;inset-inline-start:34px">
           <img src="${ICON}" alt=""><span>tilawah.cc</span>
         </div>`,
      ),
      { waitUntil: 'load' },
    );
    await frame.evaluate(() => document.fonts.ready);
    await frame.screenshot({ path: join(BRANDED, file) });
    console.log(`brand-shots: ${file}`);
  }

  // 2. Banners, on paper: the tile is the mark and the name, the marquee adds
  //    the slogan and the URL.
  const banner = (width, height, size) => page(
    `<div style="position:relative;width:${width}px;height:${height}px;background:${PAPER};overflow:hidden">
       <div style="position:absolute;inset-block-end:-40%;inset-inline-start:-12%;width:60%;height:130%;
         background:${WAVE};opacity:.06;border-radius:50%"></div>
       <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
         gap:${Math.round(size * 0.28)}px;padding:0 ${Math.round(size * 0.5)}px">
         <img src="${ICON}" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.22)}px" alt="">
         <div style="min-width:0">
           <div style="font-size:${Math.round(size * 0.36)}px;line-height:1.25;white-space:nowrap">رفيق تلاوة</div>
           <div style="font-size:${Math.round(size * 0.15)}px;color:${MUTED};margin-block-start:${Math.round(size * 0.06)}px;white-space:nowrap">
             القرآن أقرب إليك</div>
           <div style="font-size:${Math.round(size * 0.15)}px;color:${WAVE};margin-block-start:2px;direction:ltr;text-align:start">
             tilawah.cc</div>
         </div>
       </div>
     </div>`,
    `body{width:${width}px;height:${height}px}`,
  );

  for (const [name, width, height, size] of [
    ['promo-light-440x280.png', 440, 280, 72],
    ['marquee-light-1400x560.png', 1400, 560, 150],
  ]) {
    await frame.setViewportSize({ width, height });
    await frame.setContent(banner(width, height, size), { waitUntil: 'load' });
    await frame.evaluate(() => document.fonts.ready);
    await frame.screenshot({ path: join(OUT, name) });
    console.log(`brand-shots: ${name}`);
  }

  await browser.close();
};

main().then(
  () => console.log('brand-shots: done'),
  (error) => {
    console.error(`brand-shots: FAILED — ${error.message}`);
    process.exit(1);
  },
);
