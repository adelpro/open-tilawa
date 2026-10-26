import assert from 'node:assert/strict';
import { test } from 'node:test';

import { riwayaLabel } from '../src/utils/riwaya.ts';

test('riwaya names are shown in Arabic', () => {
  assert.equal(riwayaLabel('Hafs'), 'حفص');
  assert.equal(riwayaLabel('warsh'), 'ورش');
  assert.equal(riwayaLabel('Qalon'), 'قالون');
  assert.equal(riwayaLabel(undefined), 'حفص');
  assert.equal(riwayaLabel('Shubah'), 'Shubah');
});
