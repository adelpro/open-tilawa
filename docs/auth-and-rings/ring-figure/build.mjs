import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "file:///home/adelpro/.config/opencode/skills/anatomy/kit/iso-kit.mjs";
import * as G from "file:///home/adelpro/.config/opencode/skills/anatomy/kit/lathe.mjs";
import * as T from "file:///home/adelpro/.config/opencode/skills/anatomy/kit/tube.mjs";
import { kitScript } from "file:///home/adelpro/.config/opencode/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 620;
const HEIGHT = 420;

/* ---------- the machine ---------- */

const PLINTH_R = 114;
const PLINTH_H = 9;
const PLATTER_R = 102;
const PLATTER_H = 6;
const TOP = PLINTH_H + PLATTER_H; // 15 — the platter surface
const PLATE_H = 3.6;
const RING_R = 44;
const WIRE_R = 3.4;
const RING_Z = 20; // wire centre: it sits through the bows
const KEY_LEN = 56; // bow centre to tip
const LIFT = 11;
const ANGLES = [0, 120, 240];

const polar = (r, deg) => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];

const fitPoints = [];
for (let deg = 0; deg < 360; deg += 15) {
  const [x, y] = polar(PLINTH_R, deg);
  fitPoints.push([x, y, 0], [x, y, TOP + PLATE_H]);
}
for (const deg of ANGLES) {
  const [x, y] = polar(KEY_LEN, deg);
  fitPoints.push([x, y, TOP + PLATE_H + (deg === 0 ? LIFT : 0)]);
}

const P = k.fitProjection(fitPoints, WIDTH, HEIGHT, { pad: 18, azimuth: 40, elevation: 33 });

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);

/* ---------- plinth ---------- */

function plinth() {
  const out = [];
  const F = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const PLINTH_PLAN = { x: -PLINTH_R, y: -PLINTH_R, w: 2 * PLINTH_R, d: 2 * PLINTH_R, r: PLINTH_R };
  out.push(
    `<path class="iso-halo" d="${k.haloOf(PLINTH_PLAN, -6, 0.1, P)}" style="filter:blur(6px)"/>`,
  );

  for (const deg of [30, 150, 270]) {
    const [x, y] = polar(PLINTH_R - 24, deg);
    out.push(S(k.cylinder(x, y, 7, -6, 3, P, 26), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -3, 3, P, 26), { tone: "mid" }));
  }

  out.push(
    S(
      G.solidOf(
        [
          [0, PLINTH_R - 1.4],
          [3, PLINTH_R],
          [PLINTH_H, PLINTH_R],
          [PLINTH_H, PLINTH_R - 2.2],
        ],
        F,
        P,
      ),
      { tone: "lo" },
    ),
  );
  out.push(k.fadedSvg(G.ribsOf(F, 1.6, PLINTH_H - 0.8, PLINTH_R - 0.2, 96, P, { fade: [0.08, 0.5] }), { tone: "faint" }));
  out.push(L(G.arcOf(F, PLINTH_H - 0.8, PLINTH_R, P, { slope: 0, least: 0.08 }), { tone: "lo" }));
  out.push(L(G.arcOf(F, 1.6, PLINTH_R, P, { slope: 0, least: 0.08 }), { tone: "lo" }));

  // turntable scale on the plinth margin
  out.push(L(G.arcOf(F, PLINTH_H, PLINTH_R - 2.2, P, { slope: 0, least: 0.08 }), { tone: "faint" }));
  const ticks = k.radialTicks(0, 0, 100, 120, 10, TOP, [3.2, 8.3], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.lineOnTop(polar(PLATTER_R, 0), polar(PLINTH_R - 2.2, 0), PLINTH_H, P), { tone: "hi" }));

  // the platter
  out.push(S(k.cylinder(0, 0, PLATTER_R, PLINTH_H, PLATTER_H, P, 96, 1.1), { tone: "mid" }));
  out.push(L(k.ring(0, 0, PLATTER_R - 1.6, TOP, P, 96), { tone: "lo" }));
  for (const r of [9, 17, 25, 33]) out.push(L(k.ring(0, 0, r, TOP, P, 72), { tone: "faint" }));
  out.push(L(k.ring(0, 0, 100, TOP, P, 96), { tone: "faint" }));
  out.push(D([at([0, 0, TOP])], { size: 0.5, tone: "lo" }));

  const screws = [60, 90, 150, 180, 270, 300].map((d) => polar(88, d));
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.1, TOP, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, TOP])), { size: 0.42 }));

  return out.join("");
}

/* ---------- the split ring ---------- */

function ringPoints(fromDeg, toDeg, samples) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / samples;
    const [x, y] = polar(RING_R, deg);
    pts.push([x, y, RING_Z]);
  }
  return pts;
}

function ring() {
  const pieces = T.tubePieces(ringPoints(97, 447, 72), WIRE_R, P, { maxLength: 15, spacing: 2, caps: true });
  return pieces
    .sort((a, b) => k.depthOf(a.mid, P) - k.depthOf(b.mid, P))
    .map((piece) => T.tubeSvg(piece, { tone: "lit" }))
    .join("");
}

/* ---------- a key ---------- */

function keyPolygon() {
  const top = 2.7;
  return [
    [9, 5.6],
    [15, 5.6],
    [18, top],
    [KEY_LEN, top],
    [KEY_LEN, -top],
    // identical bitting on all three keys
    [54, -1.3],
    [52, -2.7],
    [49, -0.9],
    [47, -2.7],
    [44, -1.6],
    [42, -2.7],
    [39, -1.0],
    [37, -2.7],
    [34, -1.7],
    [32, -2.7],
    [28, -2.7],
    [23, -4.6],
    [9, -5.6],
  ];
}

function keyAt(deg) {
  const [cx, cy] = polar(RING_R, deg);
  const a = (deg * Math.PI) / 180;
  const u = [Math.cos(a), Math.sin(a)];
  const v = [-Math.sin(a), Math.cos(a)];
  const world = ([pu, pv]) => [cx + u[0] * pu + v[0] * pv, cy + u[1] * pu + v[1] * pv];

  const out = [];
  const polygon = keyPolygon().map(world);
  out.push(S(k.extrude(polygon, TOP, PLATE_H, P, { convex: false, bevel: 0.35 }), { tone: "hi", crease: "lo" }));
  out.push(D([26, 31, 36].map((u) => at([...world([u, 0.9]), TOP + PLATE_H])), { size: 0.45, tone: "lo" }));

  const F = G.frameOf([cx, cy, TOP], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  out.push(S(G.ringBand(TOP, TOP + PLATE_H, 6, 12, F, P, { hole: [TOP + PLATE_H, 6], steps: 64 }), { tone: "hi" }));
  out.push(D(G.dotsOf(F, TOP + PLATE_H, 9, 3, P, { phase: 0.6, least: 0.2 }), { size: 0.4, tone: "lo" }));

  return out.join("");
}

/* ---------- assembly ---------- */

const keys = ANGLES.map((deg) => keyAt(deg));
const svg = k
  .figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: "decorative",
    body: [
    plinth(),
    `<g data-part="key-120">${keys[1]}</g>`,
    `<g data-part="key-240">${keys[2]}</g>`,
    `<g data-part="key-0">${keys[0]}</g>`,
      ring(),
    ],
  })
  // The drawing carries no words of its own: the button around it does.
  .replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');

/* ---------- live ---------- */

const live = `
const P = ${JSON.stringify(P)};
const stage = document.querySelector(".iso-stage");
const key = stage.querySelector('[data-part="key-0"]');
const readout = document.querySelector("[data-readout]");
const spoken = stage.querySelector("[data-say]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const LIFT = ${LIFT};
let out = false, at = 0, target = 0, frame = 0, clock = 0, touring = true, visible = false, idle = 0, last = 0;

const say = () => {
  const text = out ? "2 على الحلقة · 1 خارجها" : "3 على الحلقة";
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-pressed", out ? "true" : "false");
  if (spoken.textContent !== text) spoken.textContent = text;
};
function draw() {
  key.setAttribute("transform", translateAlong(P, [0, 0, LIFT * at]));
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring && !still.matches) {
    clock += dt;
    const cycle = clock % 8.5;
    target = cycle < 1.2 ? 0 : cycle < 4.7 ? 1 : 0;
  }
  const calm = still.matches;
  at = calm ? target : at + (target - at) * (1 - Math.exp(-dt / 0.34));
  if (Math.abs(target - at) < 0.002) at = target;
  out = target === 1;
  say();
  draw();
  const moving = Math.abs(target - at) > 0.002;
  frame = visible && (moving || touring) && !calm ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
function steer(next) {
  touring = false;
  target = next ? 1 : 0;
  say();
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4200);
  run();
}
new IntersectionObserver((entries) => {
  visible = entries[entries.length - 1].isIntersecting;
  if (visible) run();
}, { rootMargin: "120px 0px" }).observe(stage);
stage.addEventListener("click", () => steer(!(at > 0.5)));
stage.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  steer(!(at > 0.5));
});
if (still.matches) touring = false;
if (location.hash === "#off") { touring = false; target = 1; at = 1; }
if (location.hash === "#on") { touring = false; target = 0; at = 0; }
say();
draw();
`;

const card = k.plateHtml({
  fig: "شكل 1",
  title: "حلقة تلاوة",
  hint: "اضغط المفتاح ليتم رفعه عن الحلقة",
  readout: "3 على الحلقة",
  keys: [
    { mark: "lit", label: "المفتاح المشترك: نسخة واحدة في كل جهاز، لا توجد نسخة رئيسية." },
    { mark: "raised", label: "حلقة المفاتيح: يمسح الجهاز نسخته ويخرج، والباقي يبقى." },
  ],
  caption:
    "ثلاثة مفاتيح متطابقة على حلقة واحدة، وليس هناك نسخة أعلى من أخرى. وإذا خرج جهاز، مسح مفتاحه محلياً، وظلت بقية الأجهزة تعمل.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="حلقة تلاوة: اضغط لرفع المفتاح أو إعادته" aria-pressed="false">${svg}<span class="sr-only" aria-live="polite" data-say>3 على الحلقة</span></div>`,
});

const style = `<style>
  .iso-plate-corner, .iso-key, .iso-caption { font-family: "Noto Naskh Arabic", ui-sans-serif, system-ui, sans-serif; }
  .iso-plate-corner { font-size: 11.5px; letter-spacing: 0; text-transform: none; }
  .iso-caption { direction: rtl; text-align: right; }
  .iso-keys { direction: rtl; }
  .iso-stage { cursor: pointer; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  /* the kit's dark tones sit at 1.3-1.7:1 on #131313; lift the two structural steps */
  .iso[data-theme="dark"] { --anatomy-lo: #666; --anatomy-faint: #3c3c3c; }
</style>`;

const html = k
  .pageHtml({ title: "حلقة تلاوة", theme, body: card, script: kitScript() + live, width: 660 })
  .replace('<html lang="en">', '<html lang="ar" dir="rtl">')
  .replace("</head>", `${style}</head>`);

const file = theme === "light" ? "ring-figure-light.html" : "ring-figure.html";
writeFileSync(join(HERE, file), html);
console.log("wrote", file);
