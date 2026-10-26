import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ayahCountLabel } from '../src/utils/arabic-count.ts';

test('ayahCountLabel agrees with the number', () => {
  assert.equal(ayahCountLabel(1), 'آية واحدة');
  assert.equal(ayahCountLabel(2), 'آيتان');
  assert.equal(ayahCountLabel(7), '7 آيات');
  assert.equal(ayahCountLabel(286), '286 آية');
  assert.equal(ayahCountLabel(0), 'آيات');
  assert.equal(ayahCountLabel(Number.NaN), 'آيات');
});
