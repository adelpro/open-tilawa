import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SURAHS } from '../src/constants/surah.ts';
import { filterReciters, filterSurahs, matchesQuery, normalizeArabic } from '../src/utils/search.ts';
import { MagnetlinkSource, type Reciter } from '../src/types/index.ts';

test('normalizeArabic removes what people leave out when typing', () => {
  assert.equal(normalizeArabic('الأنفال'), 'الانفال');
  assert.equal(normalizeArabic('طه'), 'طه');
  assert.equal(normalizeArabic('آل عمران'), 'ال عمران');
  assert.equal(normalizeArabic('الفاتِحَة'), 'الفاتحه');
  assert.equal(normalizeArabic('١٨'), '18');
  assert.equal(normalizeArabic('  الكهف  '), 'الكهف');
});

test('matchesQuery needs every token', () => {
  assert.equal(matchesQuery(['محمود خليل الحصري'], 'حصري'), true);
  assert.equal(matchesQuery(['محمود خليل الحصري'], 'محمود ورش'), false);
  assert.equal(matchesQuery(['محمود خليل الحصري (ورش)'], 'محمود ورش'), true);
  assert.equal(matchesQuery(['الكهف', 18], '18'), true);
  assert.equal(matchesQuery(['الكهف', 18], '  '), true);
});

test('surah search finds by name, without hamza, and by number', () => {
  assert.deepEqual(filterSurahs('الانفال').map((s) => s.id), [8]);
  assert.deepEqual(filterSurahs('الكهف').map((s) => s.id), [18]);
  assert.deepEqual(filterSurahs('18').map((s) => s.id), [18]);
  assert.deepEqual(filterSurahs('١٨').map((s) => s.id), [18]);
  assert.equal(filterSurahs('').length, SURAHS.length);
  assert.deepEqual(filterSurahs('لا شيء بهذا الاسم').map((s) => s.id), []);
});

test('reciter search covers the name and the source host', () => {
  const reciters: Reciter[] = [
    {
      id: 1,
      name: 'ماهر المعيقلي',
      magnet: 'magnet:?xt=urn:btih:aa',
      source: MagnetlinkSource.MP3QURAN,
      complet: true,
    },
    {
      id: 2,
      name: 'بدر التركي',
      magnet: '',
      source: MagnetlinkSource.ITQAN,
      complet: false,
    },
  ];

  assert.deepEqual(filterReciters('ماهر', reciters).map((r) => r.id), [1]);
  assert.deepEqual(filterReciters('mp3quran', reciters).map((r) => r.id), [1]);
  assert.deepEqual(filterReciters('itqan', reciters).map((r) => r.id), [2]);
  assert.equal(filterReciters('', reciters).length, 2);
});
