import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ROUTE_TABLE } from '../src/routes.ts';

const CONF = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf-8');

/** The `location / { … }` block, which is the one that catches everything. */
const rootLocation = /location \/ \{([\s\S]*?)\n  \}/.exec(CONF)?.[1] ?? '';

/**
 * The edge is the only place that can say "not here" with a status code.
 *
 * The app can render a 404 screen, but if nginx answers 200 for every path a crawler sees a
 * page that exists and says nothing — a soft 404, which is worse than no page at all. So the
 * shell fallback is limited to the families the app resolves itself, and everything else is a
 * real 404.
 */
test('the catch-all location answers 404 instead of the shell', () => {
  assert.ok(rootLocation, 'no `location /` block found');
  assert.match(rootLocation, /try_files \$uri \$uri\/ =404/);
  assert.doesNotMatch(rootLocation, /\/index\.html/, 'the catch-all still falls back to the shell');
});

test('every route the app resolves today still reaches the app', () => {
  // Until the prerender step writes real files (Phase 3), every family needs the shell —
  // otherwise /about, /privacy and the rest answer 404 the moment this ships. Phase 3
  // narrows this list to the parameterised families; this assertion is the reminder.
  const families = new Set(
    ROUTE_TABLE.map((row) => row.pattern.split('/').filter(Boolean)[0]).filter(
      (segment): segment is string => Boolean(segment),
    ),
  );

  assert.ok(families.size > 0, 'no route families to check');

  for (const family of families) {
    assert.match(CONF, new RegExp(`location ~ \\^/\\([^)]*\\b${family}\\b`), `/${family} has no shell fallback`);
  }
});

test('a prerendered page is a directory, so the catch-all can find it', () => {
  // `/about` has no extension: it resolves through `$uri/`, which means the prerender step
  // must write `about/index.html`, not `about.html`. This asserts the contract the two
  // files share, so a change on one side cannot silently break the other.
  assert.match(rootLocation, /\$uri\//, 'the catch-all no longer tries a directory index');
});
