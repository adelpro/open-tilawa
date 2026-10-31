import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ROUTE_TABLE, alternatesFor, legacyHashToPath, parse, parseUrl, toPath, toUrl } from '../src/routes.ts';

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

test('static paths parse by name', () => {
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

test('a panel has no URL, a page does', () => {
  // The surah list opens inside the player from a button and has no screen of its own, so
  // the table refuses to own it and nginx answers 404. The roster is the other way round:
  // `/reciters` is a page, and it is the one hub a crawler is invited to.
  for (const path of ['/surahs', '/surahs/18-al-kahf', '/reciters/minshawi']) {
    assert.deepEqual(parse(path), { name: 'notFound' }, path);
  }
  assert.deepEqual(parse('/reciters'), { name: 'reciters' });
});

test('an old hash URL is rewritten to its path', () => {
  assert.equal(legacyHashToPath('#/about'), '/about');
  assert.equal(legacyHashToPath('#/'), '/');
  assert.equal(legacyHashToPath('#/?view=favorites'), '/favorites?view=favorites');
  assert.equal(legacyHashToPath(''), null);
  assert.equal(legacyHashToPath('#not-a-route'), null);
});

/**
 * The language layer. Arabic is the product's first language, so it keeps the
 * bare path — every URL that exists today keeps working and keeps ranking — and
 * English lives under a prefix, which is what gives a crawler two pages to rank
 * instead of one page it must choose a language for.
 */

test('a path says which language it is in, and Arabic is the default', () => {
  assert.deepEqual(parseUrl('/about'), { locale: 'ar', route: { name: 'about' } });
  assert.deepEqual(parseUrl('/en/about'), { locale: 'en', route: { name: 'about' } });
});

test('the prefix is a segment, not a string prefix', () => {
  // `/english` is not `/en` + `glish`: an unknown first segment is a 404, not a
  // language the site does not publish.
  assert.deepEqual(parseUrl('/english'), { locale: 'ar', route: { name: 'notFound' } });
  assert.deepEqual(parseUrl('/fr/about'), { locale: 'ar', route: { name: 'notFound' } });
  assert.deepEqual(parseUrl('/en/nope'), { locale: 'en', route: { name: 'notFound' } });
});

test('the bare prefix is the English home, with or without a trailing slash', () => {
  assert.deepEqual(parseUrl('/en'), { locale: 'en', route: { name: 'home' } });
  assert.deepEqual(parseUrl('/en/'), { locale: 'en', route: { name: 'home' } });
});

test('a listen path keeps its release and surah inside the prefix', () => {
  assert.deepEqual(parseUrl('/en/listen/minshawi/18-al-kahf'), {
    locale: 'en',
    route: { name: 'listen', release: 'minshawi', surah: 18, surahName: 'al-kahf' },
  });
});

test('toUrl writes the prefix for English and nothing for Arabic', () => {
  assert.equal(toUrl({ name: 'home' }, 'ar'), '/');
  assert.equal(toUrl({ name: 'home' }, 'en'), '/en');
  assert.equal(toUrl({ name: 'about' }, 'ar'), '/about');
  assert.equal(toUrl({ name: 'about' }, 'en'), '/en/about');
  assert.equal(
    toUrl({ name: 'listen', release: 'minshawi', surah: 18, surahName: 'al-kahf' }, 'en'),
    '/en/listen/minshawi/18-al-kahf',
  );
});

test('parseUrl and toUrl round-trip every path in both languages', () => {
  const paths = ['/', '/about', '/privacy', '/reciters', '/listen/minshawi/18-al-kahf'];
  for (const path of paths) {
    for (const locale of ['ar', 'en'] as const) {
      const url = toUrl(parse(path), locale);
      const parsed = parseUrl(url);
      assert.equal(parsed.locale, locale, url);
      assert.deepEqual(parsed.route, parse(path), url);
      assert.equal(toUrl(parsed.route, parsed.locale), url, url);
    }
  }
});

test('alternatesFor gives the pair a crawler has to choose between', () => {
  assert.deepEqual(alternatesFor('/about'), { ar: '/about', en: '/en/about' });
  assert.deepEqual(alternatesFor('/en/about'), { ar: '/about', en: '/en/about' });
  assert.deepEqual(alternatesFor('/'), { ar: '/', en: '/en' });
  assert.deepEqual(alternatesFor('/en'), { ar: '/', en: '/en' });
});
