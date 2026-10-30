import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ROUTE_TABLE, legacyHashToPath, parse, toPath } from '../src/routes.ts';

test('a listen path carries the release and the surah', () => {
  assert.deepEqual(parse('/listen/minshawi/18-al-kahf'), {
    name: 'listen',
    release: 'minshawi',
    surah: 18,
    surahName: 'al-kahf',
  });
});

test('the surah name segment is optional decoration', () => {
  assert.deepEqual(parse('/listen/minshawi/18'), {
    name: 'listen',
    release: 'minshawi',
    surah: 18,
    surahName: '',
  });
});

test('hub and static paths parse by name', () => {
  assert.deepEqual(parse('/surahs/18-al-kahf'), { name: 'surah', surah: 18, surahName: 'al-kahf' });
  assert.deepEqual(parse('/reciters/minshawi'), { name: 'reciter', release: 'minshawi' });
  assert.deepEqual(parse('/'), { name: 'home' });
  assert.deepEqual(parse('/about'), { name: 'about' });
  assert.deepEqual(parse('/settings'), { name: 'settings' });
});

test('an unknown path or an out-of-range surah is a 404', () => {
  assert.deepEqual(parse('/nope'), { name: 'notFound' });
  assert.deepEqual(parse('/listen/minshawi/115'), { name: 'notFound' });
  assert.deepEqual(parse('/surahs/0'), { name: 'notFound' });
});

test('toPath round-trips every canonical path', () => {
  const paths = [
    '/',
    '/about',
    '/privacy',
    '/settings',
    '/account',
    '/favorites',
    '/recent',
    '/reciters',
    '/surahs',
    '/reciters/minshawi',
    '/surahs/18-al-kahf',
    '/listen/minshawi/18-al-kahf',
  ];
  for (const path of paths) assert.equal(toPath(parse(path)), path, path);
});

test('toPath writes the current surah name, so a stale one can be redirected', () => {
  assert.equal(
    toPath({ name: 'listen', release: 'minshawi', surah: 18, surahName: 'alkahf' }),
    '/listen/minshawi/18-al-kahf',
  );
});

test('every indexable route is in the sitemap', () => {
  for (const row of ROUTE_TABLE) {
    if (row.index) assert.equal(row.sitemap, true, row.name);
  }
});

test('an old hash URL is rewritten to its path', () => {
  assert.equal(legacyHashToPath('#/about'), '/about');
  assert.equal(legacyHashToPath('#/'), '/');
  assert.equal(legacyHashToPath('#/?view=favorites'), '/favorites?view=favorites');
  assert.equal(legacyHashToPath(''), null);
  assert.equal(legacyHashToPath('#not-a-route'), null);
});
