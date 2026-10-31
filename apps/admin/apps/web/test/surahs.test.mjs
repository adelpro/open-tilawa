import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { surahName } from '../src/lib/surahs.ts';

/**
 * The name table is the only place a surah id becomes something an operator can
 * recognise, and it is typed by hand, so the ends and the empty slots are worth a
 * test: an off-by-one here would label every row with its neighbour's name.
 */
describe('surah names', () => {
  it('names the first and last surah', () => {
    assert.equal(surahName(1), 'الفاتحة');
    assert.equal(surahName(114), 'الناس');
  });

  it('has a distinct name for every id in 1…114', () => {
    const names = Array.from({ length: 114 }, (_, index) => surahName(index + 1));
    assert.equal(names.filter((name) => !name).length, 0);
    assert.equal(new Set(names).size, 114);
  });

  it('returns null outside the mushaf', () => {
    assert.equal(surahName(0), null);
    assert.equal(surahName(115), null);
    assert.equal(surahName(-1), null);
    assert.equal(surahName(Number.NaN), null);
  });
});
