import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * The add-on page once carried a literal empty href while the static build read
 * the store table, so the crawler advertised a listing the hydrated page never
 * linked. The guard keeps the rendered buttons on the same table as the HTML.
 */
const PAGE = readFileSync(new URL('../src/app/extension-page.tsx', import.meta.url), 'utf-8');

test('the rendered browser buttons take their links from the store table', () => {
  for (const browser of ['chrome', 'firefox', 'edge']) {
    assert.match(
      PAGE,
      new RegExp(`href: STORE_URLS\\.${browser}`),
      `the ${browser} listing must reach the rendered page, not only the prerendered HTML`,
    );
  }
});
