import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SURAHS } from '../src/constants/surah.ts';
import {
  nextSurahInRelease,
  previousSurahInRelease,
  surahInRelease,
  surahsForRelease,
} from '../src/utils/release-surahs.ts';

/**
 * The catalogue's `surahs` is a manifest, not a preference: it decides which rows
 * a release may offer. A wrong empty answer would hide real surahs, so the unknown
 * case has to stay the whole book.
 */

test('a manifest is the release: only those rows survive', () => {
  assert.deepEqual(
    surahsForRelease([19, 1, 18]).map((surah) => surah.id),
    [1, 18, 19],
  );
});

test('unknown, empty and absent all mean the whole book', () => {
  assert.equal(surahsForRelease(null).length, SURAHS.length);
  assert.equal(surahsForRelease(undefined).length, SURAHS.length);
  assert.equal(surahsForRelease([]).length, SURAHS.length);
});

test('an id outside the mushaf is ignored, never rendered', () => {
  assert.deepEqual(
    surahsForRelease([0, 18, 115]).map((surah) => surah.id),
    [18],
  );
});

test('resume lands on a carried surah, never on a missing one', () => {
  assert.equal(surahInRelease(18, [19, 1, 18]), 18);
  assert.equal(surahInRelease(36, [19, 1, 18]), 1);
  assert.equal(surahInRelease(36, null), 36);
  assert.equal(surahInRelease(36, []), 36);
});

test('transport steps over the gaps a partial release has', () => {
  assert.equal(nextSurahInRelease(1, [1, 18, 19]), 18);
  assert.equal(nextSurahInRelease(18, [1, 18, 19]), 19);
  assert.equal(nextSurahInRelease(19, [1, 18, 19]), null);
  assert.equal(previousSurahInRelease(19, [1, 18, 19]), 18);
  assert.equal(previousSurahInRelease(1, [1, 18, 19]), null);
  // An unknown manifest keeps the plain arithmetic the hook always had.
  assert.equal(nextSurahInRelease(1, null), 2);
  assert.equal(previousSurahInRelease(18, null), 17);
});
