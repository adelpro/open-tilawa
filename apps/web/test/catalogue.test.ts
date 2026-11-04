import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toReciters } from '../src/utils/catalogue.ts';

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Maher_Al-Muaiqly_(MP3_Quran)',
  nameAr: 'ماهر المعيقلي',
  riwaya: 'Hafs',
  infohash: '5e0becf35d91ea4602f04db90d74621a172aa396',
  magnet: 'magnet:?xt=urn:btih:5e0becf35d91ea4602f04db90d74621a172aa396&dn=x',
  fileCount: 114,
  ...over,
});

test('the roster arrives in alphabetical order, not catalogue order', () => {
  const list = toReciters([
    row({ id: 2, nameAr: 'ياسين الجزائري' }),
    row({ id: 4, nameAr: 'عبد الباسط عبد الصمد', infohash: 'a'.repeat(40) }),
    row({ id: 9, nameAr: 'ماهر المعيقلي', infohash: 'b'.repeat(40) }),
  ]);
  assert.deepEqual(
    list.map((reciter) => reciter.name),
    ['عبد الباسط عبد الصمد', 'ماهر المعيقلي', 'ياسين الجزائري'],
  );
});

test('the Arabic name wins over the cleaned torrent name', () => {
  assert.equal(toReciters([row()])[0].name, 'ماهر المعيقلي');
  assert.equal(
    toReciters([row({ nameAr: null, name: 'Quran-MP3-Ghamdi' })])[0].name,
    'Quran MP3 Ghamdi',
  );
});

test('riwaya is whatever the row says, including unknown', () => {
  assert.equal(toReciters([row({ riwaya: 'unknown' })])[0].riwaya, 'unknown');
  assert.equal(toReciters([row({ riwaya: '' })])[0].riwaya, 'unknown');
});

test('complet follows the file count', () => {
  assert.equal(toReciters([row({ fileCount: 114 })])[0].complet, true);
  assert.equal(toReciters([row({ fileCount: 80 })])[0].complet, false);
});

test('rows without a magnet or a numeric id are dropped', () => {
  assert.equal(toReciters([row({ magnet: '' })]).length, 0);
  assert.equal(toReciters([row({ id: undefined })]).length, 0);
});

test('duplicate infohashes collapse to the first row', () => {
  const list = toReciters([row({ id: 7 }), row({ id: 9, nameAr: 'مكرر' })]);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 7);
});

test('the catalogue publishes the slug it was given, and never invents one', () => {
  assert.equal(toReciters([row({ slug: 'maher-al-muaiqly' })])[0].slug, 'maher-al-muaiqly');
  // A release without a slug is still playable: it simply has no link, because the web is
  // not allowed to derive one from a mutable name. Keeping it in the roster also means a
  // web deploy that lands before the admin one does not empty the list.
  assert.equal(toReciters([row({ slug: undefined })])[0].slug, '');
});

test('the English label is the release name, kept beside the Arabic one', () => {
  const reciter = toReciters([row({ name: 'Yassine_El_Jazairi_Warsh', nameAr: 'ياسين الجزائري' })])[0];
  assert.equal(reciter.name, 'ياسين الجزائري');
  assert.equal(reciter.nameEn, 'Yassine El Jazairi Warsh');
});

test('a row with no latin name falls back to the Arabic name', () => {
  const reciter = toReciters([row({ name: '', nameAr: 'ياسين الجزائري' })])[0];
  assert.equal(reciter.nameEn, 'ياسين الجزائري');
});
