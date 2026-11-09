/**
 * Re-shoots the checked-in PNGs beside these docs.
 *
 * Run after editing either figure:
 *   node docs/auth-and-rings/shoot.mjs
 *
 * Node 22, a Chromium binary (CHROME_PATH, else google-chrome), and playwright
 * (PLAYWRIGHT_MODULE, else the gstack checkout). Everything is captured at
 * deviceScaleFactor 2 with a 6px pad so a 1120px card lands on 2264px.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const PW = process.env.PLAYWRIGHT_MODULE || join(process.env.HOME, "code/gstack/node_modules/playwright");
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const PAD = 6;

let chromium;
try {
  ({ chromium } = require(PW));
} catch (error) {
  console.error(`Cannot load playwright from ${PW}. Set PLAYWRIGHT_MODULE to a playwright install.`);
  throw error;
}

const file = (name) => pathToFileURL(join(HERE, name)).href;

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });

async function capture(page, selector, out, hash = "") {
  await page.goto(file(out.page) + hash);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no box for ${selector} in ${out.page}`);
  const path = join(HERE, out.path);
  await page.screenshot({
    path,
    fullPage: true,
    clip: {
      x: Math.max(0, box.x - PAD),
      y: Math.max(0, box.y - PAD),
      width: box.width + PAD * 2,
      height: box.height + PAD * 2,
    },
  });
  console.log(`${out.path}  ${Math.round((box.width + PAD * 2) * 2)}x${Math.round((box.height + PAD * 2) * 2)}`);
}

const wide = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await capture(wide, "#flow", { page: "flow-diagrams/index.html", path: "flow-diagrams/shots/flow.png" });
await capture(wide, "#where", { page: "flow-diagrams/index.html", path: "flow-diagrams/shots/where.png" });
await wide.close();

const ring = await browser.newPage({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 2 });
await capture(ring, ".iso-page", { page: "ring-figure/ring-figure.html", path: "ring-figure/shots/ring-dark.png" });
await capture(ring, ".iso-page", { page: "ring-figure/ring-figure-light.html", path: "ring-figure/shots/ring-light.png" });
await capture(ring, ".iso-page", { page: "ring-figure/ring-figure.html", path: "ring-figure/shots/ring-dark-lifted.png" }, "#off");
await capture(ring, ".iso-page", { page: "ring-figure/ring-figure-light.html", path: "ring-figure/shots/ring-light-lifted.png" }, "#off");
await ring.close();

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await capture(phone, ".iso-page", { page: "ring-figure/ring-figure-light.html", path: "ring-figure/shots/ring-phone.png" });
await phone.close();

await browser.close();
