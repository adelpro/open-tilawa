import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * The add-on page once carried a literal empty href while the static build read
 * the store table, so the crawler advertised a listing the hydrated page never
 * linked. The guard keeps the rendered buttons on the same table as the HTML.
 */
const PAGE = readFileSync(new URL('../src/app/extension-page.tsx', import.meta.url), 'utf-8');

test('the rendered Firefox button takes its link from the store table', () => {
  assert.match(
    PAGE,
    /href: STORE_URLS\.firefox/,
    'a live listing must reach the rendered page, not only the prerendered HTML',
  );
});
