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

import { ROUTE_TABLE, alternatesFor, parse, surahSlug, toUrl } from '../src/routes.ts';
import { pageTitle } from '../src/utils/page-title.ts';
import { riwayaLabel } from '../src/utils/riwaya.ts';
import { sortByArabicName } from '../src/utils/reciter-order.ts';
import { surahName } from '../src/utils/surah-name.ts';
import { SURAHS } from '../src/constants/surah.ts';
import { SURAH_NAMES_EN } from '../src/i18n/surah-names-en.ts';
import { MESSAGES } from '../src/i18n/messages.ts';
import { shellHeadTags } from './head.mjs';

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
// Everything in the head that is not copy: the manifest link, the chrome, the
// launcher icon, the font preloads. Replacing <head> used to drop them on every
// page, which is how the site kept a manifest no document linked.
const shellHead = shellHeadTags(shell).join('\n    ');

if (assets.length === 0) {
  console.error('prerender: no module script in dist/index.html — run vite build first');
  process.exit(1);
}

const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The two languages the build writes. Arabic is first: it is the site's default. */
const LOCALES = ['ar', 'en'];
const COPY = { ar: MESSAGES.ar, en: MESSAGES.en };

/** What the document itself needs: the language, the direction, the og locale. */
const DOCUMENT = {
  ar: { dir: 'rtl', ogLocale: 'ar_AR' },
  en: { dir: 'ltr', ogLocale: 'en_US' },
};

/** The address of one page in one language, taken from the router and nowhere else. */
const urlFor = (path, locale) => `${SITE}${toUrl(parse(path), locale)}`;

function page({ locale, path, title, description, index, body, canonical = true }) {
  // One form per page, and it is the path the table declares — `/about`, not `/about/`.
  // The sitemap writes the same string, and nginx redirects the trailing-slash form to it.
  // A page with no canonical (the 404) has no language twin, so it names its own path.
  const url = canonical ? urlFor(path, locale) : `${SITE}${path}`;
  const robots = index ? 'index, follow' : 'noindex, follow';
  // The pair, in the form Google reads: each language, plus the page a visitor with no
  // preference should land on. Arabic is x-default because it is the site's own language.
  const alternates = canonical
    ? (() => {
        const pair = alternatesFor(path);
        return [['ar', pair.ar], ['en', pair.en], ['x-default', pair.ar]]
          .map(([lang, target]) => `<link rel="alternate" hreflang="${lang}" href="${SITE}${target}" />`)
          .join('\n    ');
      })()
    : '';
  return `<!doctype html>
<html lang="${locale}" dir="${DOCUMENT[locale].dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    ${canonical ? `<link rel="canonical" href="${url}" />` : ''}
    ${alternates}
    <meta name="robots" content="${robots}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Tilawah" />
    <meta property="og:locale" content="${DOCUMENT[locale].ogLocale}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    ${shellHead}
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

/**
 * One page, both languages.
 *
 * `build` is asked for the words in each language, so a page cannot be written in one
 * language and claimed to be in another: whatever it returns is used for both the HTML
 * and the sitemap row, and the head's `lang` comes from the loop, not from the caller.
 */
function addPage(path, build) {
  for (const locale of LOCALES) {
    const meta = build(locale, COPY[locale]);
    write(toUrl(parse(path), locale), page({ path, locale, ...meta }));
    pages.push({ path, locale, ...meta });
  }
}

addPage('/', (locale, copy) => ({
  title:
    locale === 'ar' ? 'Tilawah — القرآن الكريم ندّاً بندّ' : 'Tilawah — the Quran, closer',
  description: copy.about.lede,
  index: indexable('home'),
  body: `<h1>${escape(copy.about.title)}</h1><p>${escape(copy.about.lede)}</p>`,
}));

addPage('/about', (_locale, copy) => ({
  title: pageTitle({ name: 'about' }, copy) ?? 'عن تلاوة — Tilawah',
  description: copy.about.lede,
  index: indexable('about'),
  body: `<h1>${escape(copy.about.title)}</h1>` +
    [copy.about.how, copy.about.noPeers, copy.about.ring, copy.about.sources, copy.about.open]
      .map((section) => `<h2>${escape(section.title)}</h2><p>${escape(section.p1)}</p>`)
      .join(''),
}));

addPage('/privacy', (_locale, copy) => ({
  title: pageTitle({ name: 'privacy' }, copy) ?? 'الخصوصية — Tilawah',
  description: copy.about.lede,
  index: indexable('privacy'),
  body: `<h1>${escape(copy.privacy.title)}</h1><ul>${copy.privacy.items
    .map((item) => `<li>${escape(item)}</li>`)
    .join('')}</ul>`,
}));

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
  // The page must read the way the app reads: /reciters sorts names the same
  // way the roster does, so the static HTML and the SPA agree row for row.
  catalogue = sortByArabicName(
    catalogue,
    (release) => release.nameAr?.trim() || release.name,
  );
  if (catalogue.length === 0) throw new Error('catalogue returned no releases');
} catch (error) {
  console.error(`prerender: ${error instanceof Error ? error.message : error}`);
  console.error('prerender: refusing to write a site with no catalogue');
  process.exit(1);
}

// The roster, written down: the one hub with a screen behind it. The app renders the
// same rows from the same catalogue, so the names a crawler reads are the names it can
// act on — and the page is worth the sitemap row it gets.
addPage('/reciters', (_locale, copy) => ({
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
}));

// One page per reciter: this is the site's unit of grouping, and the reason the roster
// is worth a sitemap row. Every page carries 114 real links out, which is what keeps it
// from being the same 114 words with one name changed.
for (const release of catalogue) {
  if (!release.slug) continue;
  addPage(`/reciters/${release.slug}`, (locale, copy) => {
    const name = release.nameAr ?? release.name;
    const rows = SURAHS.map(
      (surah) =>
        `<li><a href="${toUrl(
          {
            name: 'listen',
            release: release.slug,
            surah: surah.id,
            surahName: surahSlug(surah.id),
          },
          locale,
        )}">${surah.id}. ${escape(surahName(surah.id, locale))}</a></li>`,
    ).join('');
    return {
      title: `${name} — Tilawah`,
      description: copy.reciterPage.lede(name),
      index: indexable('reciter'),
      body:
        `<h1>${escape(name)}</h1>` +
        `<p>${escape(copy.reciterPage.lede(name))}</p><ul>${rows}</ul>`,
    };
  });
}

for (const release of catalogue) {
  if (!release.slug) continue;
  for (const surah of SURAHS) {
    const name = release.nameAr ?? release.name;
    addPage(`/listen/${release.slug}/${surah.id}-${surahSlug(surah.id)}`, (locale) => {
      // The surah name in the language of the page: a listener looking for الكهف does
      // not search for "Al-Kahf", and a share card must read like the page behind it.
      const surahName = locale === 'ar' ? surah.name : SURAH_NAMES_EN[surah.id] ?? surah.name;
      return locale === 'ar'
        ? {
            title: `سورة ${surah.name} — ${name}`,
            description: `استمع إلى سورة ${surah.name} بصوت ${name}.`,
            index: indexable('listen'),
            body: `<h1>سورة ${escape(surah.name)} — ${escape(name)}</h1>`,
          }
        : {
            title: `Surah ${surahName} — ${name}`,
            description: `Listen to Surah ${surahName} recited by ${name}.`,
            index: indexable('listen'),
            body: `<h1>Surah ${escape(surahName)} — ${escape(name)}</h1>`,
          };
    });
  }
}

const listed = pages.filter((entry) => entry.index);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${listed
  .map((entry) => {
    // Both languages, each with the pair spelled out: this is the half of hreflang a
    // crawler can read without loading either page, and the only place it can learn
    // that `/about` and `/en/about` are one document in two languages.
    const pair = alternatesFor(entry.path);
    return `  <url>
    <loc>${urlFor(entry.path, entry.locale)}</loc>
    <lastmod>${TODAY}</lastmod>
    <xhtml:link rel="alternate" hreflang="ar" href="${SITE}${pair.ar}" />
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${pair.en}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${pair.ar}" />
  </url>`;
  })
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
    locale: 'ar',
    title: pageTitle({ name: 'notFound' }, COPY.ar) ?? 'هذه الصفحة غير موجودة — Tilawah',
    description: COPY.ar.about.lede,
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
