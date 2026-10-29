import assert from 'node:assert/strict';
import { test } from 'node:test';

import { riwayaLabel } from '../src/utils/riwaya.ts';

test('riwaya names are shown in Arabic', () => {
  assert.equal(riwayaLabel('Hafs'), 'حفص');
  assert.equal(riwayaLabel('warsh'), 'ورش');
  assert.equal(riwayaLabel('Qalon'), 'قالون');
  assert.equal(riwayaLabel('Shubah'), 'Shubah');
});

test('the al-Douri spelling the catalogue stores is named in Arabic', () => {
  // The import takes the riwaya as an argument, so the catalogue holds the
  // spelling the operator typed; both spellings are the same reading.
  assert.equal(riwayaLabel('al-Douri'), 'الدوري');
  assert.equal(riwayaLabel('al-Duri'), 'الدوري');
});

test('an unknown riwaya is said, not assumed to be Hafs', () => {
  assert.equal(riwayaLabel('unknown'), 'غير محدّد');
  assert.equal(riwayaLabel(undefined), 'غير محدّد');
  assert.equal(riwayaLabel(''), 'غير محدّد');
});
