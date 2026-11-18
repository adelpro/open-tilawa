import { describe, expect, test } from 'vitest';

import type { Reciter } from '../src/lib/catalogue';
import { markSeen, pickNew } from '../src/lib/new-reciter';

const reciter = (id: number, nameAr: string): Reciter => ({
  infohash: String(id).repeat(40).slice(0, 40),
  slug: `slug-${id}`,
  name: nameAr,
  nameAr,
  riwaya: 'Hafs',
  sizeBytes: 1e9,
  surahs: null,
  swarm: null,
  complete: true,
});

describe('pickNew', () => {
  test('an empty baseline means nothing is new — a fresh install is not told twelve things arrived', () => {
    const rows = [reciter(1, 'أ'), reciter(2, 'ب')];

    expect(pickNew(rows, [])).toEqual([]);
  });

  test('a hash the device has not seen is new, newest id first', () => {
    const rows = [reciter(1, 'أ'), reciter(2, 'ب'), reciter(3, 'ج')];

    expect(pickNew(rows, [rows[0]!.infohash, rows[2]!.infohash]).map((row) => row.nameAr)).toEqual(['ب']);
  });

  test('seen hashes are unioned, not replaced', () => {
    expect(markSeen(['a'], ['b', 'a'])).toEqual(['a', 'b']);
  });

  test('a returning reciter that was already seen is not new again', () => {
    const rows = [reciter(1, 'أ')];
    const seen = markSeen([], rows.map((row) => row.infohash));

    expect(pickNew(rows, seen)).toEqual([]);
  });
});
