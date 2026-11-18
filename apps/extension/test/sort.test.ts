import { describe, expect, test } from 'vitest';

import { sortReciters } from '../src/lib/sort';
import type { Reciter } from '../src/lib/catalogue';

const reciter = (over: Partial<Reciter> & { id?: number }): Reciter & { id?: number } => ({
  infohash: 'a'.repeat(40),
  slug: 's',
  name: 'Saber',
  nameAr: 'صابر',
  riwaya: 'Hafs',
  sizeBytes: 1e9,
  surahs: null,
  swarm: null,
  complete: true,
  ...over,
});

const names = (rows: Reciter[]) => rows.map((row) => row.nameAr);

describe('sortReciters', () => {
  const rows = [
    reciter({ nameAr: 'ماهر', riwaya: 'Hafs', sizeBytes: 1.3e9, id: 3 }),
    reciter({ nameAr: 'عبد الله', riwaya: 'Warsh', sizeBytes: 0.5e9, id: 2 }),
    reciter({ nameAr: 'صابر', riwaya: 'al-Douri', sizeBytes: 2.3e9, id: 1 }),
  ];

  test('name uses Arabic collation and defaults to ascending', () => {
    expect(names(sortReciters(rows, { key: 'name', dir: 'asc' }, 'ar'))).toEqual([
      'صابر',
      'عبد الله',
      'ماهر',
    ]);
  });

  test('clicking the active column flips it, it does not reset', () => {
    expect(names(sortReciters(rows, { key: 'name', dir: 'desc' }, 'ar'))).toEqual([
      'ماهر',
      'عبد الله',
      'صابر',
    ]);
  });

  test('size orders numerically, smallest first', () => {
    expect(sortReciters(rows, { key: 'size', dir: 'asc' }, 'ar').map((row) => row.sizeBytes)).toEqual([
      0.5e9,
      1.3e9,
      2.3e9,
    ]);
  });

  test('new means the catalogue id, newest first', () => {
    expect(sortReciters(rows, { key: 'new', dir: 'asc' }, 'ar').map((row) => row.id)).toEqual([3, 2, 1]);
  });

  test('a reciter of unknown size sorts last in both directions', () => {
    const withUnknown = [...rows, reciter({ nameAr: 'بلا حجم', sizeBytes: null, id: 9 })];
    const asc = sortReciters(withUnknown, { key: 'size', dir: 'asc' }, 'ar');
    const desc = sortReciters(withUnknown, { key: 'size', dir: 'desc' }, 'ar');

    expect(asc[asc.length - 1]!.nameAr).toBe('بلا حجم');
    expect(desc[desc.length - 1]!.nameAr).toBe('بلا حجم');
  });

  test('ties keep the order they arrived in', () => {
    const tied = [
      reciter({ nameAr: 'أ', riwaya: 'Hafs', id: 1 }),
      reciter({ nameAr: 'ب', riwaya: 'Hafs', id: 2 }),
    ];
    expect(names(sortReciters(tied, { key: 'riwaya', dir: 'asc' }, 'ar'))).toEqual(['أ', 'ب']);
  });
});
