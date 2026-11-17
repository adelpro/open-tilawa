import { describe, expect, test } from 'vitest';

import type { Reciter } from '../src/lib/catalogue';
import { filterByRiwaya, riwayaOptions } from '../src/lib/filter';

const reciter = (riwaya: string, nameAr: string): Reciter => ({
  infohash: (nameAr.charCodeAt(0) + riwaya.length).toString(16).padStart(40, '0').slice(0, 40),
  slug: nameAr,
  name: nameAr,
  nameAr,
  riwaya,
  sizeBytes: 1e9,
  surahs: null,
  swarm: null,
  complete: true,
});

const rows = [
  reciter('Hafs', 'أ'),
  reciter('Warsh', 'ب'),
  reciter('Hafs', 'ج'),
  reciter('al-Douri', 'د'),
];

describe('riwayaOptions', () => {
  test('lists each riwaya once, sorted, with its count', () => {
    expect(riwayaOptions(rows)).toEqual([
      { riwaya: 'al-Douri', count: 1 },
      { riwaya: 'Hafs', count: 2 },
      { riwaya: 'Warsh', count: 1 },
    ]);
  });

  test('an empty roster has no options', () => {
    expect(riwayaOptions([])).toEqual([]);
  });
});

describe('filterByRiwaya', () => {
  test('no selection means everything — a filter that starts empty must not hide the roster', () => {
    expect(filterByRiwaya(rows, [])).toHaveLength(4);
  });

  test('one riwaya keeps only its reciters', () => {
    expect(filterByRiwaya(rows, ['Hafs']).map((row) => row.nameAr)).toEqual(['أ', 'ج']);
  });

  test('several riwayat are a union, in roster order', () => {
    expect(filterByRiwaya(rows, ['Warsh', 'al-Douri']).map((row) => row.nameAr)).toEqual(['ب', 'د']);
  });

  test('a riwaya nobody has yields nothing rather than everything', () => {
    expect(filterByRiwaya(rows, ['Qalon'])).toEqual([]);
  });
});
