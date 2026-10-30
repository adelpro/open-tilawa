// Screenshots of the ring UI, on a running build.
//
// Usage:
//   BASE_URL=http://localhost:8137 node screens.mjs [outDir]
//   (needs playwright; `npx playwright install chromium` once)
//
// It creates a real ring on the relay the build points at, then links a second
// browser context through the manual paste path — the camera cannot be driven
// headless, and the paste field is the documented fallback, not a mock. The
// pairing therefore exercises the same redeem → auth → device-row path the
// scanner does. Use a relay you do not mind writing to, and delete nothing:
// a throwaway ring is invisible to the catalogue.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] || resolve(here, 'shots'));
const base = process.env.BASE_URL || 'http://localhost:8137';
mkdirSync(outDir, { recursive: true });

// A machine with Chrome but without Playwright's own download can point at the
// system binary: CHROME_PATH=/usr/bin/google-chrome node screens.mjs
const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);

async function context(label) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 860 },
    deviceScaleFactor: 2,
    locale: 'ar',
    colorScheme: 'light',
  });
  // The clipboard is how the ticket leaves device A without a camera on B. It
  // is captured here rather than read back, because a headless context often
  // has no clipboard permission.
  await ctx.addInitScript(() => {
    window.__copied = null;
    const write = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (navigator.clipboard && write) {
      navigator.clipboard.writeText = async (text) => {
        window.__copied = text;
        return write(text);
      };
    }
  });
  const page = await ctx.newPage();
  page.on('pageerror', (error) => console.error(`[${label}]`, error.message));
  await page.goto(base, { waitUntil: 'networkidle' });
  return { ctx, page };
}

async function openAccount(page) {
  await page.getByRole('button', { name: 'القائمة' }).click();
  await page.getByRole('button', { name: 'الحساب', exact: true }).click();
  await page.getByRole('heading', { name: 'الحساب' }).waitFor();
}

const shot = (page, name) =>
  page.screenshot({ path: resolve(outDir, name) }).then(() => console.log('→', name));

const a = await context('A');
await openAccount(a.page);
await a.page.getByLabel('اسم الحلقة').fill('حلقة العرض');
await a.page.getByRole('button', { name: 'إنشاء حلقة' }).click();
// The count is written optimistically, so this is the ring existing on screen,
// not on the relay.
await a.page.getByText('جهاز واحد').waitFor({ timeout: 20_000 });
await shot(a.page, '01-ring-created.png');

await a.page.getByRole('button', { name: 'إضافة جهاز' }).click();
await a.page.getByRole('button', { name: 'إظهار رمز الربط' }).click();
await a.page.getByText(/ينتهي خلال/).waitFor({ timeout: 20_000 });
await shot(a.page, '02-pairing-code.png');

await a.page.getByRole('button', { name: 'نسخ الرمز' }).click();
const ticket = await a.page.evaluate(() => window.__copied);
if (!ticket) throw new Error('the ticket never reached the clipboard');

const b = await context('B');
await openAccount(b.page);
await b.page.getByRole('button', { name: 'إدخال الرمز يدوياً' }).first().click();
await b.page.getByLabel('إدخال الرمز يدوياً').fill(ticket);
await b.page.getByRole('button', { name: 'ربط' }).click();
await b.page.getByText('تم ربط هذا الجهاز بالحلقة').waitFor({ timeout: 30_000 });
// B's own row is written locally; A's row arrives from the relay a moment later.
await b.page.getByText('جهازان').waitFor({ timeout: 30_000 });
await shot(b.page, '03-this-device-joined.png');

// The whole point of the change: A's popup closes itself, and A lands on the
// device list with the new row highlighted.
await a.page.getByText(/ينتهي خلال/).waitFor({ state: 'detached', timeout: 30_000 });
await a.page.getByText(/أُضيف «/).waitFor({ timeout: 30_000 });
await a.page.getByText('جهازان').waitFor({ timeout: 30_000 });
await shot(a.page, '04-device-added-elsewhere.png');

await browser.close();
