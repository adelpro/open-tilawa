import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { surahName } from '../src/lib/surahs.ts';

/**
 * The name tables are the only place a surah id becomes something an operator can
 * recognise, and they are typed by hand, so the ends and the empty slots are worth
 * a test: an off-by-one here would label every row with its neighbour's name.
 *
 * Both languages are checked because they are separate lists: English could be
 * one short without Arabic noticing.
 */
describe('surah names', () => {
  it('names the first and last surah in each language', () => {
    assert.equal(surahName(1, 'ar'), 'الفاتحة');
    assert.equal(surahName(114, 'ar'), 'الناس');
    assert.equal(surahName(1, 'en'), 'Al-Fatihah');
    assert.equal(surahName(114, 'en'), 'Al-Nas');
  });

  it('has a distinct name for every id in 1…114, per language', () => {
    for (const locale of ['ar', 'en']) {
      const names = Array.from({ length: 114 }, (_, index) => surahName(index + 1, locale));
      assert.equal(names.filter((name) => !name).length, 0, `${locale} has a gap`);
      assert.equal(new Set(names).size, 114, `${locale} repeats a name`);
    }
  });

  it('returns null outside the mushaf, in either language', () => {
    for (const locale of ['ar', 'en']) {
      assert.equal(surahName(0, locale), null);
      assert.equal(surahName(115, locale), null);
      assert.equal(surahName(-1, locale), null);
      assert.equal(surahName(Number.NaN, locale), null);
    }
  });
});
