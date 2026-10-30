#!/usr/bin/env node
/**
 * Write the pages a crawler can read, and the files it asks for first.
 *
 * Why prerender rather than SSR: the app is a Vite SPA with a hand-rolled router and no
 * data loaders, so there is nothing to stream — the only thing a crawler was missing is the
 * words. This writes those words into the shell at build time and leaves the SPA to take
 * over on mount.
 *
 * Directories, not files: nginx resolves a path through `$uri/`, so `/about` needs
 * `about/index.html`. (`apps/web/test/nginx.test.ts` asserts that half of the contract.)
 *
 * The catalogue is the only source of releases, so an unreachable catalogue fails the
 * build: shipping a site with the hub pages missing is worse than not shipping.
 *
 * Run with the test loader so `@/…` aliases resolve:
 *   node --experimental-strip-types --import ./test/alias-register.mjs scripts/prerender.mjs
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROUTE_TABLE, surahSlug } from '../src/routes.ts';
import { pageTitle } from '../src/utils/page-title.ts';
import { riwayaLabel } from '../src/utils/riwaya.ts';
import { SURAHS } from '../src/constants/surah.ts';
import { MESSAGES } from '../src/i18n/messages.ts';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(WEB, 'dist');
const SITE = process.env.SITE_URL ?? 'https://tilawah.cc';
const ADMIN_API = process.env.VITE_ADMIN_API_URL ?? 'https://console.tilawah.cc';
const TODAY = new Date().toISOString().slice(0, 10);

const shell = readFileSync(join(DIST, 'index.html'), 'utf-8');
const assets = [
  ...shell.matchAll(/<script[^>]*src="[^"]+"[^>]*><\/script>/g),
  ...shell.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g),
].map((match) => match[0]);

if (assets.length === 0) {
  console.error('prerender: no module script in dist/index.html — run vite build first');
  process.exit(1);
}

const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const copy = MESSAGES.ar;

function page({ path, title, description, index, body, canonical = true }) {
  // One form per page, and it is the path the table declares — `/about`, not `/about/`.
  // The sitemap writes the same string, and nginx redirects the trailing-slash form to it.
  const url = `${SITE}${path}`;
  const robots = index ? 'index, follow' : 'noindex, follow';
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    ${canonical ? `<link rel="canonical" href="${url}" />` : ''}
    <meta name="robots" content="${robots}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Tilawah" />
    <meta property="og:locale" content="ar_AR" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    ${assets.join('\n    ')}
  </head>
  <body>
    <div id="root">${body ?? ''}</div>
  </body>
</html>
`;
}

function write(path, html) {
  const target = path === '/' ? join(DIST, 'index.html') : join(DIST, path.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
}

/** Every page this build writes, in the order the sitemap lists them. */
const pages = [];

/**
 * Whether a crawler may rank this family, read from the route table.
 *
 * Not a literal in this file: the table is what the router, this build and the sitemap
 * are supposed to agree on, and when this script carried its own flag the table said one
 * thing while the sitemap said another. `test/prerender.test.ts` keeps the decision out
 * of here.
 */
const indexable = (name) => ROUTE_TABLE.find((row) => row.name === name)?.index ?? false;

function add(path, meta) {
  write(path, page({ path, ...meta }));
  pages.push({ path, ...meta });
}

add('/', {
  title: 'Tilawah — القرآن الكريم ندّاً بندّ',
  description: copy.about.lede,
  index: indexable('home'),
  body: `<h1>${escape(copy.about.title)}</h1><p>${escape(copy.about.lede)}</p>`,
});

add('/about', {
  title: pageTitle({ name: 'about' }, copy) ?? 'عن تلاوة — Tilawah',
  description: copy.about.lede,
  index: indexable('about'),
  body: `<h1>${escape(copy.about.title)}</h1>` +
    [copy.about.how, copy.about.noPeers, copy.about.ring, copy.about.sources, copy.about.open]
      .map((section) => `<h2>${escape(section.title)}</h2><p>${escape(section.p1)}</p>`)
      .join(''),
});

add('/privacy', {
  title: pageTitle({ name: 'privacy' }, copy) ?? 'الخصوصية — Tilawah',
  description: copy.about.lede,
  index: indexable('privacy'),
  body: `<h1>${escape(copy.privacy.title)}</h1><ul>${copy.privacy.items
    .map((item) => `<li>${escape(item)}</li>`)
    .join('')}</ul>`,
});

// The catalogue is the only source of releases. A build without it would publish hub
// pages that link nowhere, so it stops here instead.
let catalogue = [];
try {
  const response = await fetch(`${ADMIN_API}/api/public/reciters?page=1&range=200`, {
    headers: { 'User-Agent': 'tilawa-prerender/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`catalogue answered ${response.status}`);
  const body = await response.json();
  catalogue = Array.isArray(body.reciters) ? body.reciters : [];
  if (catalogue.length === 0) throw new Error('catalogue returned no releases');
} catch (error) {
  console.error(`prerender: ${error instanceof Error ? error.message : error}`);
  console.error('prerender: refusing to write a site with no catalogue');
  process.exit(1);
}

// The roster, written down: the one hub with a screen behind it. The app renders the
// same rows from the same catalogue, so the names a crawler reads are the names it can
// act on — and the page is worth the sitemap row it gets.
add('/reciters', {
  title: pageTitle({ name: 'reciters' }, copy) ?? 'القرّاء — Tilawah',
  description: copy.recitersPage.lede,
  index: indexable('reciters'),
  body:
    `<h1>${escape(copy.recitersPage.title)}</h1><p>${escape(copy.recitersPage.lede)}</p><ul>` +
    catalogue
      .map(
        (release) =>
          `<li>${escape(release.nameAr ?? release.name)} — ${escape(riwayaLabel(release.riwaya))}</li>`,
      )
      .join('') +
    '</ul>',
});

for (const release of catalogue) {
  if (!release.slug) continue;
  for (const surah of SURAHS) {
    add(`/listen/${release.slug}/${surah.id}-${surahSlug(surah.id)}`, {
      title: `سورة ${surah.name} — ${release.nameAr ?? release.name}`,
      description: `استمع إلى سورة ${surah.name} بصوت ${release.nameAr ?? release.name}.`,
      index: indexable('listen'),
      body: `<h1>سورة ${escape(surah.name)} — ${escape(release.nameAr ?? release.name)}</h1>`,
    });
  }
}

const listed = pages.filter((entry) => entry.index);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${listed
  .map((entry) => `  <url><loc>${SITE}${entry.path === '/' ? '/' : entry.path}</loc><lastmod>${TODAY}</lastmod></url>`)
  .join('\n')}
</urlset>
`,
);

writeFileSync(
  join(DIST, 'robots.txt'),
  `# One document per route, each with its own head; the sitemap is the list a crawler reads.
User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`,
);

writeFileSync(
  join(DIST, '404.html'),
  page({
    path: '/404',
    title: pageTitle({ name: 'notFound' }, copy) ?? 'هذه الصفحة غير موجودة — Tilawah',
    description: copy.about.lede,
    // Not a route: this is the page nginx serves with a 404, so it can never be indexed.
    index: false,
    canonical: false,
  }),
);

const prerendered = ROUTE_TABLE.filter((row) => row.prerender).map((row) => row.name);
console.log(
  `prerender: ${pages.length} page(s) from ${catalogue.length} release(s); ` +
    `sitemap lists ${listed.length}; route families: ${prerendered.join(', ')}`,
);
