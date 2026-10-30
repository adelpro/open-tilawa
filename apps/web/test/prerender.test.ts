import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

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
  for (const name of ['home', 'about', 'privacy', 'listen']) {
    assert.match(
      SOURCE,
      new RegExp(`index: indexable\\('${name}'\\)`),
      `\`${name}\` does not take its indexability from ROUTE_TABLE`,
    );
  }
});

test('the sitemap lists the pages the table calls indexable', () => {
  // The sitemap is `pages.filter(entry => entry.index)` and every entry's `index` comes
  // from the helper above, so the filter is the table. Asserted on the filter's shape.
  assert.match(SOURCE, /pages\.filter\(\(entry\) => entry\.index\)/);
});
