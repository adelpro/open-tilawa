#!/usr/bin/env node
/**
 * Prerender the public pages, and write the files a crawler asks for first.
 *
 * Why prerender rather than SSR: the app is a Vite SPA with a hand-rolled router and
 * no data loaders, so there is nothing to stream — the only thing a crawler was
 * missing is the words. This writes those words into the shell at build time, in the
 * markup the Landing screen also renders, and leaves the SPA to take over on mount.
 * No server, no framework, no runtime cost.
 *
 * The outputs:
 *   dist/<file>                 the page, with its own head and its static content
 *   dist/robots.txt             disallow the app, allow the roots
 *   dist/sitemap.xml            the public pages, with lastmod
 *   dist/llms.txt               the same pages, as the llms.txt an assistant reads
 *   dist/manifest.webmanifest   install metadata
 *
 * The copy comes from `seo/pages.json`, which is the same text the catalogue renders.
 * A page that says one thing to a crawler and another to a visitor is cloaking; the
 * test `seo.test.mjs` compares them.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
// An explicit target lets the test run the generator against a stub build instead of
// depending on `vite build` having just happened.
const DIST = process.argv[2] ? resolve(process.argv[2]) : join(WEB, 'dist');
const data = JSON.parse(readFileSync(join(WEB, 'seo', 'pages.json'), 'utf-8'));
const app = JSON.parse(readFileSync(join(WEB, 'app.json'), 'utf-8'));
const site = data.site.replace(/\/$/, '');
const builtAt = new Date().toISOString();

/** The shell Vite produced: its asset tags are the only parts worth keeping. */
const shell = readFileSync(join(DIST, 'index.html'), 'utf-8');
const scriptTags = [...shell.matchAll(/<script[^>]*src="[^"]+"[^>]*><\/script>/g)].map((m) => m[0]);
const styleTags = [...shell.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0]);

if (scriptTags.length === 0) {
  throw new Error('prerender: no module script in dist/index.html — did vite build run?');
}

const escape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const jsonLd = (page) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${site}/#organization`,
        name: 'Tilawa Admin',
        url: `${site}/`,
        logo: `${site}/icon-512.png`,
      },
      {
        '@type': 'WebApplication',
        '@id': `${site}/#app`,
        name: 'Tilawa Admin',
        url: `${site}/`,
        description: page.en.description,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any',
        inLanguage: ['en', 'ar'],
        publisher: { '@id': `${site}/#organization` },
      },
    ],
  });

function head(page, copy, canonicalUrl) {
  return `<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(copy.title)}</title>
    <meta name="description" content="${escape(copy.description)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="${app.chrome.light}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${app.chrome.dark}" media="(prefers-color-scheme: dark)" />
    <meta name="color-scheme" content="light dark" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Tilawa Admin" />
    <meta property="og:title" content="${escape(copy.title)}" />
    <meta property="og:description" content="${escape(copy.description)}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:image" content="${site}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Tilawa Admin — Quran audio distribution: seeders, TURN, torrents and reciters" />
    <meta property="og:locale" content="en" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(copy.title)}" />
    <meta name="twitter:description" content="${escape(copy.description)}" />
    <meta name="twitter:image" content="${site}/og.png" />

    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.webmanifest" />

    <script type="application/ld+json">${jsonLd(page)}</script>
    ${styleTags.join('\n    ')}
    ${scriptTags.join('\n    ')}
  </head>`;
}

/**
 * The static body: the same elements the Landing screen renders, with the same class
 * names, so the stylesheet applies and a visitor without JavaScript sees a finished
 * page rather than a div. React clears it on mount.
 */
function body(copy) {
  // Every block is conditional: a legal page has no steps and no call to action, and
  // an empty <p> of empty buttons is worse than a shorter page. The landing page keeps
  // all four, so its markup is unchanged.
  const features = copy.features.length
    ? `<section class="landing__features">${copy.features
        .map(
          (feature) => `
        <article class="landing__feature">
          <h2 class="display-sm">${escape(feature.title)}</h2>
          <p class="body muted">${escape(feature.body)}</p>
        </article>`,
        )
        .join('')}
        </section>`
    : '';
  const steps = copy.steps.items.length
    ? `<section class="landing__steps">
          <h2 class="display-sm">${escape(copy.steps.title)}</h2>
          <ol>
          ${copy.steps.items.map((item) => `<li>${escape(item)}</li>`).join('\n          ')}
          </ol>
        </section>`
    : '';
  const cta = copy.cta
    ? `<p class="cluster"><a class="btn btn--primary" href="/console/signup">${escape(copy.cta)}</a><a class="btn btn--tertiary" href="/console/signin">${escape(copy.secondary)}</a></p>`
    : '';
  const note = copy.note ? `<p class="fine-print">${escape(copy.note)}</p>` : '';

  return `<div id="root">
      <div class="landing">
        <header class="landing__hero">
          <div class="landing__copy">
            <p class="landing__brand">${escape(copy.brand)}</p>
            <h1 class="display-lg">${escape(copy.h1)}</h1>
            <p class="body muted">${escape(copy.lede)}</p>
            ${cta}
            ${note}
          </div>
          <div class="landing__mark" aria-hidden="true">
            <span class="landing__ring landing__ring--outer"></span>
            <span class="landing__ring landing__ring--inner"></span>
            <span class="landing__dot"></span>
          </div>
        </header>
        ${features}
        ${steps}
      </div>
    </div>`;
}

function page(page, copy) {
  const canonicalUrl = `${site}${page.path === '/' ? '/' : page.path}`;
  // Hreflang is declared only for the language that actually has HTML. There is no
  // `/ar` page yet, and pointing a crawler at English HTML labelled `ar` is worse
  // than saying nothing.
  return `<!doctype html>
<html lang="${copy.lang}" dir="${copy.lang === 'ar' ? 'rtl' : 'ltr'}">
  ${head(page, copy, canonicalUrl)}
  <body>
    ${body(copy)}
  </body>
</html>
`;
}

for (const entry of data.pages) {
  const target = join(DIST, entry.file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, page(entry, entry.en), 'utf-8');
}

const urls = data.pages
  .map(
    (entry) => `  <url>
    <loc>${site}${entry.path}</loc>
    <lastmod>${builtAt.slice(0, 10)}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
  )
  .join('\n');

writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
  'utf-8',
);

writeFileSync(
  join(DIST, 'robots.txt'),
  `# The public pages are the only thing worth indexing. Everything under /console is
# behind a session, and the API and MCP endpoint have nothing for a crawler.
User-agent: *
Allow: /$
Disallow: /console
Disallow: /api/
Disallow: /mcp
Disallow: /reset-password
Disallow: /activate
Disallow: /2fa

Sitemap: ${site}/sitemap.xml
`,
  'utf-8',
);

// llms.txt, generated from the same pages as the sitemap: one source, so an
// assistant and a crawler can never be told different things about the product.
// The console needing an account is the fact a visitor would learn from the page
// and an assistant would not.
const lines = data.pages.map((entry) => {
  const url = entry.path === '/' ? `${site}/` : `${site}${entry.path}`;
  return `- [${entry.en.title}](${url}): ${entry.en.description}`;
});

writeFileSync(
  join(DIST, 'llms.txt'),
  `# Tilawa Admin

> ${data.pages[0].en.lede}

The console itself requires an account. The pages below describe what it does and
how it is run; \`/console\`, the API and the MCP endpoint are not public.

## Pages
${lines.join('\n')}
`,
  'utf-8',
);

writeFileSync(
  join(DIST, 'manifest.webmanifest'),
  `${JSON.stringify(
    {
      ...app.manifest,
      description: data.pages[0].en.description,
      // `background_color` comes from app.json, not from the page: the splash and
      // the launcher share one icon, so the splash field has to be the plate that
      // icon is painted on. The browser bar still follows the page (theme_color).
      theme_color: app.chrome.light,
      // Install UI screenshots: desktop stats panel (wide) + mobile home (narrow).
      // PNG on the console palette; captured from the product, not mocks.
      screenshots: [
        {
          src: '/screenshots/console-wide.png',
          sizes: '1280x720',
          type: 'image/png',
          form_factor: 'wide',
          label: 'Analytics — requests, latency and per-tool pass/fail',
        },
        {
          src: '/screenshots/home-narrow.png',
          sizes: '390x844',
          type: 'image/png',
          form_factor: 'narrow',
          label: 'Tilawa Admin — Quran audio distribution: seeders, TURN, torrents and reciters',
        },
      ],
    },
    null,
    2,
  )}\n`,
  'utf-8',
);

console.log(
  `prerender: ${data.pages.length} page(s), sitemap, robots, llms.txt and manifest written to dist/`,
);
