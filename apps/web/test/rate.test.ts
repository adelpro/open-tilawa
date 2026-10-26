import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatRate, nearerRate, nextRate, RATES } from '../src/utils/rate.ts';

test('nextRate steps through the list and wraps', () => {
  assert.equal(nextRate(1), 1.25);
  assert.equal(nextRate(1.5), 2);
  assert.equal(nextRate(2), 0.75);
  assert.equal(nextRate(0.75), 1);
});

test('nextRate treats anything unknown as 1x', () => {
  assert.equal(nextRate(0), 1);
  assert.equal(nextRate(1.1), 1.25);
  assert.equal(nextRate(Number.NaN), 1);
});

test('nearerRate keeps a stored value inside the offered set', () => {
  assert.equal(nearerRate(1.4), 1.5);
  assert.equal(nearerRate(0.1), RATES[0]);
  assert.equal(nearerRate(9), RATES[RATES.length - 1]);
  assert.equal(nearerRate(undefined), 1);
});

test('formatRate never prints 1.00', () => {
  assert.equal(formatRate(1), '1x');
  assert.equal(formatRate(1.5), '1.5x');
  assert.equal(formatRate(0.75), '0.75x');
});
