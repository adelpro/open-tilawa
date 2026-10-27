import assert from 'node:assert/strict';
import { test } from 'node:test';

import { riwayaLabel } from '../src/utils/riwaya.ts';

test('riwaya names are shown in Arabic', () => {
  assert.equal(riwayaLabel('Hafs'), 'حفص');
  assert.equal(riwayaLabel('warsh'), 'ورش');
  assert.equal(riwayaLabel('Qalon'), 'قالون');
  assert.equal(riwayaLabel('Shubah'), 'Shubah');
});

test('an unknown riwaya is said, not assumed to be Hafs', () => {
  assert.equal(riwayaLabel('unknown'), 'غير محدّد');
  assert.equal(riwayaLabel(undefined), 'غير محدّد');
  assert.equal(riwayaLabel(''), 'غير محدّد');
});
