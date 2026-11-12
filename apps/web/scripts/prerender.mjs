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
import { surahsForRelease } from '../src/utils/release-surahs.ts';
import { breadcrumbTrail, combinedGraph, faqPage, reciterGraph, websiteGraph } from '../src/utils/schema.ts';
import { SURAHS } from '../src/constants/surah.ts';
import { SURAH_NAMES_EN } from '../src/i18n/surah-names-en.ts';
import { MESSAGES } from '../src/i18n/messages.ts';
import { PEER_PORT_COMMAND, installCommand } from '../src/constants/seeder.ts';
import { SEED_CLIENTS } from '../src/constants/seed-clients.ts';
import { siteManifest } from '../src/utils/site-version.ts';
import { shellHeadTags } from './head.mjs';
import { escapeHtml as escape } from './html.mjs';
import { seedBody } from './seed-body.mjs';

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

/** The name the page shows for the site, not a second spelling invented here. */
const siteName = (locale) => (locale === 'ar' ? 'تلاوة' : 'Tilawah');

function page({
  locale,
  path,
  title,
  description,
  index,
  body,
  jsonLd,
  canonical = true,
  canonicalUrl,
  pair = true,
}) {
  // One form per page, and it is the path the table declares — `/about`, not `/about/`.
  // The sitemap writes the same string, and nginx redirects the trailing-slash form to it.
  // A page with no canonical (the 404) has no language twin, so it names its own path.
  const url = canonical ? urlFor(path, locale) : `${SITE}${path}`;
  // `og:url` stays the page's own address even when the canonical points at its twin:
  // a share of the English page must land on the English page, not silently switch language.
  const canonicalHref = canonicalUrl ?? url;
  const robots = index ? 'index, follow' : 'noindex, follow';
  // The pair, in the form Google reads: each language, plus the page a visitor with no
  // preference should land on. Arabic is x-default because it is the site's own language.
  // A pair is omitted when the two URLs are not equivalents; a canonicalised twin is not
  // an alternate, and hreflang that names one contradicts the canonical.
  const alternates = canonical && pair
    ? (() => {
        const targets = alternatesFor(path);
        return [['ar', targets.ar], ['en', targets.en], ['x-default', targets.ar]]
          .map(([lang, target]) => `<link rel="alternate" hreflang="${lang}" href="${SITE}${target}" />`)
          .join('\n    ');
      })()
    : '';
  // JSON-LD is data, not copy: `<` is the only character that can end the script
  // element, so it is escaped and the rest is the serialised graph.
  const structuredData = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';
  return `<!doctype html>
<html lang="${locale}" dir="${DOCUMENT[locale].dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    ${canonical ? `<link rel="canonical" href="${canonicalHref}" />` : ''}
    ${alternates}
    <meta name="robots" content="${robots}" />
    ${structuredData}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Tilawah" />
    <meta property="og:locale" content="${DOCUMENT[locale].ogLocale}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:image" content="${SITE}/og-2026-11.png" />
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
    locale === 'ar' ? 'Tilawah - القرآن الكريم ندّاً بندّ' : 'Tilawah - the Quran, closer',
  description: copy.about.lede,
  index: indexable('home'),
  // The app itself is the document: `WebSite` says what the address is, and
  // `WebApplication` says it is a free, browser-run player.
  jsonLd: websiteGraph({
    site: SITE,
    name: siteName(locale),
    alternateName: locale === 'ar' ? 'Tilawah' : 'تلاوة',
  }),
  body: `<h1>${escape(copy.about.title)}</h1><p>${escape(copy.about.lede)}</p>`,
}));

addPage('/about', (locale, copy) => {
  const about = copy.about;
  const seedUrl = urlFor('/seed', locale);
  return {
    title: pageTitle({ name: 'about' }, copy) ?? 'عن تلاوة - Tilawah',
    description: about.lede,
    index: indexable('about'),
    // The visible questions and the markup are one list; a page that answers in
    // words and tells a crawler something else is cloaking.
    jsonLd: faqPage(
      about.faq.items.map((item) => ({ question: item.q, answer: item.a })),
    ),
    body:
      `<h1>${escape(about.title)}</h1><p>${escape(about.lede)}</p><p>${escape(about.lede2)}</p>` +
      `<h2>${escape(about.how.title)}</h2><p>${escape(about.how.p1)}</p><p>${escape(about.how.p2)}</p><p>${escape(about.how.p3)}</p>` +
      `<h2>${escape(about.noPeers.title)}</h2><p>${escape(about.noPeers.p1)}</p><p>${escape(about.noPeers.p2)}</p><p>${escape(about.noPeers.p3)}</p>` +
      `<h2>${escape(about.sync.title)}</h2><p>${escape(about.sync.p1)}</p><p>${escape(about.sync.p2)}</p><p>${escape(about.sync.p3)}</p>` +
      `<h3>${escape(about.sync.what.title)}</h3><ul>${about.sync.what.items.map((item) => `<li>${escape(item)}</li>`).join('')}</ul><p>${escape(about.sync.position)}</p>` +
      `<h2>${escape(about.sources.title)}</h2><p>${escape(about.sources.p1)}</p><p>${escape(about.sources.p2)}</p><p>${escape(about.sources.p3)}</p>` +
      `<p><a href="https://itqan.dev" aria-label="Itqan"><img src="${SITE}/images/itqan.png" alt="Itqan" height="40" /></a> <a href="https://mp3quran.net" aria-label="MP3Quran"><img src="${SITE}/images/mp3quran.png" alt="MP3Quran" height="40" /></a></p>` +
      `<h2>${escape(about.faq.title)}</h2><dl>${about.faq.items.map((item) => `<dt>${escape(item.q)}</dt><dd>${escape(item.a)}</dd>`).join('')}</dl>` +
      `<p><a href="mailto:${escape(about.faq.contact)}">${escape(about.faq.contact)}</a></p>` +
      `<h2>${escape(about.open.title)}</h2><p>${escape(about.open.p1)}</p><p>${escape(about.open.source)} <a href="https://github.com/adelpro/open-tilawa">github.com/adelpro/open-tilawa</a></p>` +
      `<h2>${escape(about.node.title)}</h2><p>${escape(about.node.p1)}</p><p>${escape(about.node.p2)}</p><p><a href="${seedUrl}">${escape(about.node.link)}</a></p>` +
      `<p>${escape(about.closing)}</p>`,
  };
});

addPage('/privacy', (_locale, copy) => ({
  title: pageTitle({ name: 'privacy' }, copy) ?? 'الخصوصية - Tilawah',
  description: copy.about.lede,
  index: indexable('privacy'),
  body: `<h1>${escape(copy.privacy.title)}</h1><ul>${copy.privacy.items
    .map((item) => `<li>${escape(item)}</li>`)
    .join('')}</ul>`,
}));

addPage('/seed', (_locale, copy) => {
  const page = copy.seedPage;
  return {
    title: pageTitle({ name: 'seed' }, copy) ?? `${copy.routes.seed} - Tilawah`,
    description: page.lede,
    index: indexable('seed'),
    body: seedBody(page, {
      command: installCommand({ diskGb: 50, uploadKbps: 20000 }),
      peerPortCommand: PEER_PORT_COMMAND,
      clients: SEED_CLIENTS,
    }),
  };
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

// The deployed site has to describe itself. A manual `docker compose up` leaves no
// trace in the console's database, so the console cannot know whether the HTML is
// current from its own rows alone; this file is the other side of that comparison.
// It is written from the same `catalogue` the pages are built from, so the two
// cannot disagree.
writeFileSync(
  join(DIST, 'site-version.json'),
  `${JSON.stringify(siteManifest(catalogue), null, 2)}\n`,
);

// The roster, written down: the one hub with a screen behind it. The app renders the
// same rows from the same catalogue, so the names a crawler reads are the names it can
// act on — and the page is worth the sitemap row it gets.
addPage('/reciters', (locale, copy) => ({
  title: pageTitle({ name: 'reciters' }, copy) ?? 'القرّاء - Tilawah',
  description: copy.recitersPage.lede,
  index: indexable('reciters'),
  jsonLd: breadcrumbTrail([
    { name: siteName(locale), url: urlFor('/', locale) },
    { name: copy.recitersPage.title, url: urlFor('/reciters', locale) },
  ]),
  body:
    `<h1>${escape(copy.recitersPage.title)}</h1><p>${escape(copy.recitersPage.lede)}</p><ul>` +
    catalogue
      .map((release) => {
        const label = `${escape(release.nameAr ?? release.name)} - ${escape(riwayaLabel(release.riwaya))}`;
        // The roster is the crawl path to every reciter page: a row without an anchor
        // was invisible to Googlebot unless the sitemap had been processed, which is
        // how one reciter got indexed and the other nine stayed unknown.
        return release.slug
          ? `<li><a href="${escape(urlFor(`/reciters/${release.slug}`, locale))}">${label}</a></li>`
          : `<li>${label}</li>`;
      })
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
    const arabicUrl = urlFor(`/reciters/${release.slug}`, 'ar');
    // A partial release's page is its shelf: only the surahs the torrent carries.
    // `file_count` says how many, the manifest says which.
    const carried = surahsForRelease(release.surahs);
    const lede =
      carried.length < SURAHS.length
        ? copy.reciterPage.ledePartial(name, carried.length)
        : copy.reciterPage.lede(name);
    const rows = carried.map(
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
      title: `${name} - Tilawah`,
      description: lede,
      index: indexable('reciter'),
      // The English page translates the chrome, not the reciter's name and not the
      // 114 links, so Google reads it as a thin twin of the Arabic page and served it
      // as a soft 404. Arabic is the document; the English twin canonicalises to it and
      // stays out of the sitemap until Phase 5 gives the English pages content of their own.
      canonicalUrl: locale === 'en' ? arabicUrl : undefined,
      sitemap: locale === 'ar',
      // Not a language pair: one of the two URLs is a canonicalised twin, and hreflang
      // naming it would contradict the canonical on the page.
      pair: false,
      // Two claims on one page: where it sits, and what it is. The second is the
      // only place the page says "these are recordings, by this person" — and the
      // only place the verse count, juz and page of each surah appear at all, since
      // the visible page is a list of links.
      jsonLd: combinedGraph(
        breadcrumbTrail([
          { name: siteName(locale), url: urlFor('/', locale) },
          { name: copy.recitersPage.title, url: urlFor('/reciters', locale) },
          { name, url: arabicUrl },
        ]),
        reciterGraph({
          site: SITE,
          url: urlFor(`/reciters/${release.slug}`, locale),
          name,
          alternateName: release.name,
          riwaya: riwayaLabel(release.riwaya),
          surahs: carried.map((surah) => ({
            name: surahName(surah.id, locale),
            url: toUrl(
              {
                name: 'listen',
                release: release.slug,
                surah: surah.id,
                surahName: surahSlug(surah.id),
              },
              locale,
            ),
            note: `${copy.sheets.verses(surah.ayahCount)} · ${copy.sheets.juz(surah.juz)} · ${copy.home.page(surah.page)}`,
          })),
        }),
      ),
      body:
        `<h1>${escape(name)}</h1>` +
        `<p>${escape(lede)}</p><ul>${rows}</ul>`,
    };
  });
}

for (const release of catalogue) {
  if (!release.slug) continue;
  for (const surah of surahsForRelease(release.surahs)) {
    const name = release.nameAr ?? release.name;
    addPage(`/listen/${release.slug}/${surah.id}-${surahSlug(surah.id)}`, (locale) => {
      // The surah name in the language of the page: a listener looking for الكهف does
      // not search for "Al-Kahf", and a share card must read like the page behind it.
      const surahName = locale === 'ar' ? surah.name : SURAH_NAMES_EN[surah.id] ?? surah.name;
      return locale === 'ar'
        ? {
            title: `سورة ${surah.name} - ${name}`,
            description: `استمع إلى سورة ${surah.name} بصوت ${name}.`,
            index: indexable('listen'),
            body: `<h1>سورة ${escape(surah.name)} - ${escape(name)}</h1>`,
          }
        : {
            title: `Surah ${surahName} - ${name}`,
            description: `Listen to Surah ${surahName} recited by ${name}.`,
            index: indexable('listen'),
            body: `<h1>Surah ${escape(surahName)} - ${escape(name)}</h1>`,
          };
    });
  }
}

// Every page the edge may hold, for the purge that follows a deploy.
//
// Not the sitemap: the English twins are canonicalised and therefore unlisted, yet
// they are served from the same cache and would keep the previous build for an hour.
// Not every written file either — the listen pages are written to disk but answered
// by the app's own location, which is never cached, and there are two thousand of
// them. `index` is exactly the set nginx serves with an edge TTL.
writeFileSync(
  join(DIST, 'purge-urls.txt'),
  [
    ...new Set(
      pages.filter((entry) => entry.index).map((entry) => urlFor(entry.path, entry.locale)),
    ),
  ].join('\n') + '\n',
);

// `sitemap: false` drops a page that is still crawlable and still index-eligible but
// canonically points at another URL: listing it would ask Google to index the twin.
const listed = pages.filter((entry) => entry.index && entry.sitemap !== false);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${listed
  .map((entry) => {
    // Both languages, each with the pair spelled out: this is the half of hreflang a
    // crawler can read without loading either page, and the only place it can learn
    // that `/about` and `/en/about` are one document in two languages. A page whose
    // twin canonicalises to it (the reciter family) has no pair to declare.
    const pair = entry.pair === false ? null : alternatesFor(entry.path);
    const alternates = pair
      ? `
    <xhtml:link rel="alternate" hreflang="ar" href="${SITE}${pair.ar}" />
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${pair.en}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${pair.ar}" />`
      : '';
    return `  <url>
    <loc>${urlFor(entry.path, entry.locale)}</loc>
    <lastmod>${TODAY}</lastmod>${alternates}
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
    title: pageTitle({ name: 'notFound' }, COPY.ar) ?? 'هذه الصفحة غير موجودة - Tilawah',
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
