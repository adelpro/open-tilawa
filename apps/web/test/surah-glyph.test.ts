import assert from 'node:assert/strict';
import { test } from 'node:test';

import { surahNameGlyph, SURAH_GLYPH_BASE } from '../src/utils/surah-glyph.ts';

test('the surah glyph is the id shifted into the private-use block', () => {
  assert.equal(surahNameGlyph(1), String.fromCharCode(SURAH_GLYPH_BASE));
  assert.equal(surahNameGlyph(114), String.fromCharCode(0xe971));
  assert.equal(surahNameGlyph(18).codePointAt(0), 0xe900 + 17);
});

test('out-of-range ids render nothing rather than a stray glyph', () => {
  assert.equal(surahNameGlyph(0), '');
  assert.equal(surahNameGlyph(115), '');
  assert.equal(surahNameGlyph(Number.NaN), '');
});
