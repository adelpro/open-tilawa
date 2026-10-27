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
