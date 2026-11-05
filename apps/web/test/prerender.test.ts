import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { shellHeadTags } from '../scripts/head.mjs';

/**
 * The rule the release got wrong once: `routes.ts` says it is the one place a path
 * exists, but the build script carried its own `index: true` per page, so the table said
 * "not announced" while the sitemap listed every one of them. The script reads the
 * decision from the table now, and this test keeps it that way — a literal is how the two
 * drifted apart in the first place.
 *
 * The build itself is not run here (it fetches the catalogue and writes `dist/`); this
 * asserts the wiring, and the sitemap is checked against the live channel after a deploy.
 */
const SOURCE = readFileSync(new URL('../scripts/prerender.mjs', import.meta.url), 'utf-8');

test('indexability is read from the route table, never written into the build', () => {
  assert.doesNotMatch(SOURCE, /index:\s*true/, 'prerender decides a page is indexable on its own');
  for (const name of ['home', 'reciters', 'about', 'privacy', 'listen', 'reciter']) {
    assert.match(
      SOURCE,
      new RegExp(`index: indexable\\('${name}'\\)`),
      `\`${name}\` does not take its indexability from ROUTE_TABLE`,
    );
  }
});

test('the sitemap lists the pages the table calls indexable', () => {
  // The sitemap is the table's `index`, minus pages that canonicalise elsewhere. Every
  // entry's `index` still comes from the helper above, so the filter is the table plus
  // the one legitimate exception: a crawlable page that is not a document of its own.
  assert.match(SOURCE, /pages\.filter\(\(entry\) => entry\.index && entry\.sitemap !== false\)/);
});

/**
 * The English reciter page is a translation of the chrome around the same Arabic name
 * and the same 114 links. Google read it as a thin twin and served a soft 404; the
 * Arabic page is the document, so the English URL canonicalises to it and the pair is
 * not declared. Revisit in Phase 5, when the English pages get content of their own.
 */
test('the English reciter page canonicalises to Arabic and leaves the sitemap', () => {
  assert.match(SOURCE, /canonicalUrl: locale === 'en' \? arabicUrl : undefined/);
  assert.match(SOURCE, /sitemap: locale === 'ar'/);
  assert.match(SOURCE, /pair: false/);
  // The canonical tag is the override, not the page's own address.
  assert.match(SOURCE, /<link rel="canonical" href="\$\{canonicalHref\}" \/>/);
  // A canonicalised twin is not an alternate; the sitemap omits its xhtml links.
  assert.match(SOURCE, /entry\.pair === false \? null : alternatesFor\(entry\.path\)/);
});

/**
 * The roster is the crawl path. A reciter row that is not an anchor makes every page
 * behind it depend on the sitemap being processed, which is how one got indexed and
 * nine stayed "URL is unknown to Google".
 */
test('the roster links to every reciter page it lists', () => {
  assert.match(
    SOURCE,
    /<li><a href="\$\{escape\(urlFor\(`\/reciters\/\$\{release\.slug\}`,\s*locale\)\)\}">/,
    'a roster row without an anchor hides its reciter page from crawlers',
  );
});

/**
 * Two languages, one page. The pair a crawler needs is the pair the router already
 * knows how to build — the build must not carry a second copy of the prefix rule.
 */
test('the prefix and the alternates come from the route table, not from this script', () => {
  assert.match(SOURCE, /import \{[^}]*alternatesFor[^}]*\} from '\.\.\/src\/routes\.ts'/, 'alternatesFor is not taken from the router');
  assert.match(SOURCE, /import \{[^}]*toUrl[^}]*\} from '\.\.\/src\/routes\.ts'/, 'toUrl is not taken from the router');
  // A literal prefix here is how the router and the build drift apart.
  assert.doesNotMatch(SOURCE, /'\/en\b/, 'the build writes its own language prefix');
});

test('every written page names its own language and the pair a crawler chooses from', () => {
  assert.match(SOURCE, /<html lang="\$\{locale\}"/, 'the document language is not written per page');
  assert.match(SOURCE, /hreflang="ar"/);
  assert.match(SOURCE, /hreflang="en"/);
  assert.match(SOURCE, /hreflang="x-default"/);
  assert.match(SOURCE, /xmlns:xhtml=/, 'the sitemap cannot carry alternates without the namespace');
});

/**
 * The install metadata is the shell's, not the page's.
 *
 * The prerenderer writes its own head from the words of one page, and it used to
 * keep only the script and the stylesheet. A manifest link, the window chrome, the
 * launcher icon and the font preloads went out with the replaced head — the site
 * served a valid manifest that no document referenced, so nothing offered install.
 */
test('the head carries what the shell had, and not the copy of one page', () => {
  const shell = `<!doctype html><html><head>
    <meta charset="UTF-8" />
    <title>Tilawah</title>
    <meta name="description" content="a page description" />
    <meta name="text-scale" content="scale" />
    <meta name="theme-color" content="#ffffff" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:title" content="a page title" />
    <link rel="canonical" href="https://tilawah.cc/" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <link rel="icon" href="/favicon.ico" />
    <link
      rel="preload"
      as="font"
      href="/fonts/a.woff2"
      crossorigin
    />
    <link rel="stylesheet" href="/assets/index.css" />
  </head><body></body></html>`;

  const kept = shellHeadTags(shell);
  const keptText = kept.join('\n');
  for (const wanted of [
    'rel="manifest"',
    'rel="apple-touch-icon"',
    'rel="icon"',
    'rel="preload"',
    'name="theme-color"',
    'name="text-scale"',
    'og:image:width',
  ]) {
    assert.match(keptText, new RegExp(wanted.replace(/[[\]]/g, '\\$&')), `${wanted} is kept`);
  }
  // One page's words belong to that page, and page() writes them itself.
  for (const dropped of ['<title>', 'name="description"', 'og:title', 'rel="canonical"', 'stylesheet']) {
    assert.doesNotMatch(keptText, new RegExp(dropped.replace(/[[\]]/g, '\\$&')), `${dropped} is not copied`);
  }
  // A tag Vite left wrapped across lines is still one tag.
  assert.match(keptText, /rel="preload"[\s\S]*href="\/fonts\/a\.woff2"/);
});

/**
 * Structured data is data, not copy: a literal graph in the build is how the
 * `WebApplication` description drifts from the page, and an unescaped `<` in a
 * JSON-LD block ends the script element.
 */
test('the graph comes from the schema module and is escaped', () => {
  assert.match(SOURCE, /import \{[^}]*websiteGraph[^}]*\} from '\.\.\/src\/utils\/schema\.ts'/);
  assert.match(SOURCE, /import \{[^}]*breadcrumbTrail[^}]*\} from '\.\.\/src\/utils\/schema\.ts'/);
  assert.match(SOURCE, /application\/ld\+json/);
  assert.ok(
    SOURCE.includes("replace(/</g, '\\\\u003c')"),
    'a `<` in JSON-LD can end the script element',
  );
  assert.match(SOURCE, /jsonLd: websiteGraph\(/);
  assert.match(SOURCE, /jsonLd: breadcrumbTrail\(/);
});

/**
 * The About page has to answer its FAQ in the HTML a crawler reads, and the
 * markup has to be built from the same list the page renders — not a second
 * copy that can drift.
 */
test('the about page carries its FAQ in words and in JSON-LD', () => {
  assert.match(SOURCE, /jsonLd: faqPage\(/);
  assert.match(SOURCE, /copy\.about\.faq\.items/);
  assert.match(SOURCE, /<h3>\$\{escape\(item\.q\)\}<\/h3>/);
});

test('the seeder page is prerendered from the route table', () => {
  assert.match(SOURCE, /addPage\('\/seed'/);
  assert.match(SOURCE, /index: indexable\('seed'\)/);
});
