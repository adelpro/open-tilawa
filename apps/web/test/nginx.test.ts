import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { ROUTE_TABLE } from '../src/routes.ts';

const CONF = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf-8');

/** The `location / { … }` block, which is the one that catches everything. */
const rootLocation = /location \/ \{([\s\S]*?)\n  \}/.exec(CONF)?.[1] ?? '';

/** The one location that hands a page path to the app. */
const pageLocation = /location ~ \^\/[^\n]*\{([\s\S]*?)\n  \}/.exec(CONF)?.[1] ?? '';

/** The same location's first line, which is where the families it accepts are named. */
const familyLine = CONF.split('\n').find((line) => line.trimStart().startsWith('location ~ ^/')) ?? '';

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
  assert.match(rootLocation, /try_files \$uri \$uri\/index\.html =404;/);
  assert.doesNotMatch(rootLocation, /^\s*\/index\.html\s*$/m, 'the catch-all still falls back to the shell');
});

test('a family the build writes completely is not handed to the app', () => {
  // `/reciters/<slug>` is a file on disk for every published reciter, so a slug that is
  // not in the roster must be a 404 — not the shell with a 200 and the app's 404 screen.
  assert.doesNotMatch(familyLine, /\breciter/, '/reciters is given a shell fallback it does not need');
});

test('every route nginx cannot resolve from disk still reaches the app', () => {
  // A prerendered page is a file on disk, and a missing one is a 404 on purpose. What
  // needs the shell is the other half: the app-only screens, and the parameterised
  // families nginx cannot verify without the catalogue.
  const families = new Set(
    ROUTE_TABLE.filter((row) => !row.complete && (!row.prerender || row.pattern.includes('{')))
      .map((row) => row.pattern.split('/').filter(Boolean)[0])
      .filter((segment): segment is string => Boolean(segment)),
  );

  assert.ok(families.size > 0, 'no route families to check');

  for (const family of families) {
    assert.match(
      familyLine,
      new RegExp(`\\b${family}\\b`),
      `/${family} has no shell fallback`,
    );
  }
});

/**
 * English lives under a prefix, so every family the app answers itself has to be
 * reachable with it — otherwise `/en/listen/...` misses the family location, falls
 * through to the catch-all, and becomes a 404 in the one language whose pages the
 * catch-all was never taught about.
 */
test('the app-only families answer under the language prefix too', () => {
  assert.match(
    CONF,
    /location ~ \^\/\(en\/\)\?\(listen\|/,
    'the family location does not accept the /en prefix',
  );
});

test('a prerendered page is served at its path, never redirected to a directory', () => {
  // `/about` has no extension, and the prerender step writes `about/index.html`. Naming
  // the directory in `try_files` (`$uri/`) makes nginx treat it as the resource and answer
  // /about with a 301 to /about/ — so the URL a visitor and a crawler land on is not the
  // one the sitemap lists, and the prerendered page is served under a different path than
  // the app's canonical route. The index file is named directly instead.
  assert.ok(pageLocation, 'no page location found');

  for (const [name, block] of [
    ['the catch-all', rootLocation],
    ['the page location', pageLocation],
  ] as const) {
    assert.doesNotMatch(block, /\$uri\/\s/, `${name} still matches a bare directory and 301s`);
    assert.match(block, /try_files \$uri \$uri\/index\.html/, `${name} does not resolve a page index`);
  }
});

test('the trailing-slash form redirects once to the sitemap URL', () => {
  // One form per page. `/about/` exists on disk either way, so the redirect has to happen
  // before a location can serve it; otherwise the same page is reachable under two URLs.
  // Relative, because the origin is behind a TLS-terminating proxy and nginx only sees http.
  assert.match(CONF, /absolute_redirect off;/);
  assert.match(CONF, /rewrite \^\/\(\.\+\)\/\$ \/\$1 permanent;/);
});

test('the media preflight allows the headers a torrent fetch actually sends', () => {
  // A fetch with `cache: 'no-store'` sends `Cache-Control: no-cache` on the preflight.
  // Allowing only `Range` fails that preflight, and the media request dies before a byte
  // arrives — the bug this test exists to prevent coming back.
  const media = /location \/media\/ \{([\s\S]*?)\n  \}/.exec(CONF)?.[1] ?? '';
  assert.ok(media, 'no /media/ location found');

  const allow = /Access-Control-Allow-Headers "([^"]+)"/.exec(media)?.[1] ?? '';
  for (const header of ['Range', 'Cache-Control', 'If-Range']) {
    assert.match(allow, new RegExp(`\\b${header}\\b`), `${header} is missing from the media preflight`);
  }
  assert.match(media, /Access-Control-Allow-Methods "GET, HEAD, OPTIONS"/);
  assert.match(media, /Access-Control-Max-Age \d+/);
});

test('a missing page is served the prerendered 404 screen', () => {
  assert.match(CONF, /error_page 404 \/404\.html;/);
  assert.match(CONF, /location = \/404\.html \{\s*internal;/);
});

test('the sitemap and robots carry the types a crawler expects', () => {
  assert.match(CONF, /location = \/sitemap\.xml \{[\s\S]*?default_type application\/xml;/);
  assert.match(CONF, /location = \/robots\.txt \{[\s\S]*?default_type text\/plain;/);
});

test('the shell is served noindex and never cached', () => {
  // The shell answers the app-only screens and any `/listen` pair nginx cannot verify.
  // Nothing served this way may be indexed, and nothing may be cached — a cached shell is
  // a deploy that never lands. It is a named location because falling back to
  // `/index.html` would be an internal redirect into `location = /index.html`, and these
  // headers would be dropped on the way.
  const shell = /location @shell \{([\s\S]*?)\n  \}/.exec(CONF)?.[1] ?? '';
  assert.ok(shell, 'no @shell block found');
  assert.match(shell, /add_header X-Robots-Tag "noindex[^"]*" always;/);
  assert.match(shell, /add_header Cache-Control "no-cache, no-store, must-revalidate" always;/);
  assert.match(pageLocation, /try_files \$uri \$uri\/index\.html @shell;/);
  assert.doesNotMatch(pageLocation, /\s\/index\.html\s*;/, 'the fallback still redirects through a path');
});
