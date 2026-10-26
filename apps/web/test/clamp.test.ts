import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clamp, seekBy } from '../src/utils/clamp.ts';

test('clamp keeps a value inside its bounds', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
  assert.equal(clamp(Number.NaN, 3, 10), 3);
});

test('seekBy moves within the file and stops at both ends', () => {
  assert.equal(seekBy(5, 15, 100), 20);
  assert.equal(seekBy(95, 15, 100), 100);
  assert.equal(seekBy(5, -15, 100), 0);
  assert.equal(seekBy(0, -15, 100), 0);
});

test('seekBy refuses to invent a position before the duration is known', () => {
  assert.equal(seekBy(5, 15, 0), 0);
  assert.equal(seekBy(5, 15, Number.NaN), 0);
});
