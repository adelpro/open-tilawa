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

import { ROUTE_TABLE, surahSlug, toPath } from '../src/routes.ts';
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

function add(path, meta) {
  write(path, page({ path, ...meta }));
  pages.push({ path, ...meta });
}

add('/', {
  title: 'Tilawah — القرآن الكريم ندّاً بندّ',
  description: copy.about.lede,
  index: true,
  body: `<h1>${escape(copy.about.title)}</h1><p>${escape(copy.about.lede)}</p>`,
});

add('/about', {
  title: 'عن تلاوة — Tilawah',
  description: copy.about.lede,
  index: true,
  body: `<h1>${escape(copy.about.title)}</h1>` +
    [copy.about.how, copy.about.noPeers, copy.about.ring, copy.about.sources, copy.about.open]
      .map((section) => `<h2>${escape(section.title)}</h2><p>${escape(section.p1)}</p>`)
      .join(''),
});

add('/privacy', {
  title: 'الخصوصية — Tilawah',
  description: copy.about.lede,
  index: true,
  body: `<h1>${escape(copy.privacy.title)}</h1><ul>${copy.privacy.items
    .map((item) => `<li>${escape(item)}</li>`)
    .join('')}</ul>`,
});

add('/reciters', { title: 'القرّاء — Tilawah', description: copy.about.lede, index: true });
add('/surahs', { title: 'السور — Tilawah', description: copy.about.lede, index: true });

const surahPage = (id) => {
  const name = SURAHS.find((surah) => surah.id === id)?.name ?? '';
  return { slug: `${id}-${surahSlug(id)}`, name };
};

for (const surah of SURAHS) {
  const { slug, name } = surahPage(surah.id);
  add(`/surahs/${slug}`, {
    title: `سورة ${name} — Tilawah`,
    description: `استمع إلى سورة ${name} بأصوات القرّاء في تلاوة.`,
    index: true,
    body: `<h1>سورة ${escape(name)}</h1>`,
  });
}

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

for (const release of catalogue) {
  if (!release.slug) continue;
  if (release.nameAr || release.name) {
    add(`/reciters/${release.slug}`, {
      title: `${release.nameAr ?? release.name} — Tilawah`,
      description: `تلاوات ${release.nameAr ?? release.name} كاملة في تلاوة.`,
      index: true,
      body: `<h1>${escape(release.nameAr ?? release.name)}</h1>`,
    });
  }
  for (const surah of SURAHS) {
    add(`/listen/${release.slug}/${surah.id}-${surahSlug(surah.id)}`, {
      title: `سورة ${surah.name} — ${release.nameAr ?? release.name}`,
      description: `استمع إلى سورة ${surah.name} بصوت ${release.nameAr ?? release.name}.`,
      index: false,
      body: `<h1>سورة ${escape(surah.name)} — ${escape(release.nameAr ?? release.name)}</h1>`,
    });
  }
}

const indexable = pages.filter((entry) => entry.index);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable
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
    title: 'هذه الصفحة غير موجودة — Tilawah',
    description: copy.about.lede,
    index: false,
    canonical: false,
  }),
);

const prerendered = ROUTE_TABLE.filter((row) => row.prerender).map((row) => row.name);
console.log(
  `prerender: ${pages.length} page(s) from ${catalogue.length} release(s); ` +
    `sitemap lists ${indexable.length}; route families: ${prerendered.join(', ')}`,
);
