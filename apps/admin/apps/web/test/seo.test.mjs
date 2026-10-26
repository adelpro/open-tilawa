import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * SEO, checked against the generator rather than against a deployment.
 *
 * The point of the phase was not "add some meta tags" — it was that a crawler gets
 * real HTML and a real answer. So these tests run the prerenderer against a stub
 * build and assert the four things that were broken: no page content, no canonical,
 * no sitemap, and a soft 404 for everything.
 */
const WEB = new URL('..', import.meta.url).pathname;
const data = JSON.parse(readFileSync(join(WEB, 'seo', 'pages.json'), 'utf-8'));

/** A stand-in for what `vite build` leaves behind: a shell with one script and one link. */
function stubDist() {
  const dir = mkdtempSync(join(tmpdir(), 'tilawa-seo-'));
  writeFileSync(
    join(dir, 'index.html'),
    '<!doctype html><html><head><link rel="stylesheet" href="/assets/x.css"></head>' +
      '<body><div id="root"></div><script type="module" src="/assets/x.js"></script></body></html>',
    'utf-8',
  );
  execFileSync(process.execPath, [join(WEB, 'scripts', 'prerender.mjs'), dir], { stdio: 'pipe' });
  return dir;
}

const dist = stubDist();
const html = readFileSync(join(dist, 'index.html'), 'utf-8');

describe('prerendered page', () => {
  it('carries the words a crawler came for', () => {
    const page = data.pages[0].en;
    assert.match(html, new RegExp(`<h1[^>]*>${page.h1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.ok(html.includes(page.lede), 'the lede is in the HTML');
    assert.ok(html.length > 3000, `expected a substantial page, got ${html.length} bytes`);
    // Static content lives inside #root so React replaces it rather than duplicating it.
    assert.match(html, /<div id="root">[\s\S]*<h1/);
  });

  it('declares language and direction in the markup, not after hydration', () => {
    assert.match(html, /<html lang="en" dir="ltr"/);
  });

  it('has a canonical, an og card and structured data', () => {
    assert.match(html, new RegExp(`<link rel="canonical" href="${data.site}/"`));
    assert.match(html, /property="og:title"/);
    assert.match(html, /property="og:image" content="https:\/\/[^"]+\/og\.png"/);
    assert.match(html, /name="twitter:card" content="summary_large_image"/);

    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(jsonLd, 'JSON-LD block present');
    const parsed = JSON.parse(jsonLd[1]);
    const types = parsed['@graph'].map((node) => node['@type']);
    assert.deepEqual(types, ['Organization', 'WebApplication']);
    assert.deepEqual(parsed['@graph'][1].inLanguage, ['en', 'ar']);
  });

  it('keeps the built asset tags', () => {
    assert.match(html, /<script type="module" src="\/assets\/x\.js">/);
    assert.match(html, /href="\/assets\/x\.css"/);
  });
});

describe('crawler files', () => {
  it('writes robots.txt that disallows the app and names the sitemap', () => {
    const robots = readFileSync(join(dist, 'robots.txt'), 'utf-8');
    assert.match(robots, /^User-agent: \*$/m);
    assert.match(robots, /^Disallow: \/dashboard$/m);
    assert.match(robots, /^Disallow: \/api\/$/m);
    assert.match(robots, new RegExp(`^Sitemap: ${data.site}/sitemap\\.xml$`, 'm'));
    // A robots.txt that is HTML is what the site served before this phase.
    assert.ok(!robots.includes('<html'));
  });

  it('writes a sitemap that lists exactly the public pages', () => {
    const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf-8');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    assert.deepEqual(
      locs,
      data.pages.map((page) => `${data.site}${page.path}`),
    );
    assert.match(sitemap, /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it('writes an install manifest with icons and a theme colour', () => {
    const manifest = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf-8'));
    assert.equal(manifest.start_url, '/');
    assert.equal(manifest.theme_color, '#086288');
    assert.equal(manifest.background_color, '#ffefc4');
    assert.equal(manifest.screenshots.filter((shot) => shot.form_factor === 'wide').length, 1);
    assert.ok(manifest.screenshots[0].label.length > 5);
    assert.ok(manifest.icons.length >= 2);
  });
});

describe('the page says the same thing the app does', () => {
  // A prerendered page that differs from the mounted screen is cloaking. The copy
  // lives twice — pages.json for the build, the catalogue for the app — so this is
  // the check that keeps the two honest.
  const en = readFileSync(join(WEB, 'src/lib/i18n/en.ts'), 'utf-8');
  const page = data.pages[0].en;

  for (const [label, text] of [
    ['h1', page.h1],
    ['lede', page.lede],
    ['cta', page.cta],
    ['note', page.note],
    ['feature 1', page.features[0].title],
    ['step 1', page.steps.items[0]],
  ]) {
    it(`uses the catalogue's ${label}`, () => {
      assert.ok(
        en.includes(text.replace(/'/g, "\\'")),
        `${label} in seo/pages.json is not in the English catalogue:\n${text}`,
      );
    });
  }
});

describe('the edge no longer answers everything with the app', () => {
  const conf = readFileSync(join(WEB, 'templates/default.conf.template'), 'utf-8');

  it('falls back to the shell only for app routes', () => {
    assert.match(
      conf,
      /location ~ \^\/\(dashboard\|reset-password\|activate\|2fa\|setup\|oauth\|about\|privacy\|terms\|signin\|signup\)\(/,
    );
  });

  it('404s anything that is not a file or an app route', () => {
    assert.match(conf, /try_files \$uri \$uri\/ =404;/);
  });

  it('serves robots and sitemap with their own types', () => {
    assert.match(conf, /location = \/robots\.txt \{\s*default_type text\/plain;/);
    assert.match(conf, /location = \/sitemap\.xml \{\s*default_type application\/xml;/);
  });
});

describe('the build actually produces these files', () => {
  const built = join(WEB, 'dist');
  it('has a prerendered index when dist exists', { skip: !existsSync(built) }, () => {
    const output = readFileSync(join(built, 'index.html'), 'utf-8');
    assert.match(output, /<h1/);
    assert.ok(existsSync(join(built, 'sitemap.xml')));
    assert.ok(existsSync(join(built, 'robots.txt')));
    assert.ok(existsSync(join(built, 'og.png')));
  });
});
