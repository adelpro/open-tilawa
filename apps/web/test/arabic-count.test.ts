import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ayahCountLabel, surahCountLabel } from '../src/utils/arabic-count.ts';

test('ayahCountLabel agrees with the number', () => {
  assert.equal(ayahCountLabel(1), 'آية واحدة');
  assert.equal(ayahCountLabel(2), 'آيتان');
  assert.equal(ayahCountLabel(7), '7 آيات');
  assert.equal(ayahCountLabel(286), '286 آية');
});

test('surahCountLabel agrees with the number', () => {
  assert.equal(surahCountLabel(1), 'سورة واحدة');
  assert.equal(surahCountLabel(2), 'سورتان');
  assert.equal(surahCountLabel(16), '16 سورة');
});
