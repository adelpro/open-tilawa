import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AGE_BUCKETS,
  RETURNING_BUCKETS,
  ageBucket,
  daysBetween,
} from '../src/utils/device-age.ts';

test('the same day is new', () => {
  assert.equal(ageBucket(0), 'new');
  assert.equal(ageBucket(-4), 'new');
  assert.equal(ageBucket(Number.NaN), 'new');
});

test('the buckets widen with age', () => {
  assert.equal(ageBucket(1), '1-3');
  assert.equal(ageBucket(3), '1-3');
  assert.equal(ageBucket(4), '4-6');
  assert.equal(ageBucket(6), '4-6');
  assert.equal(ageBucket(7), '7-13');
  assert.equal(ageBucket(13), '7-13');
  assert.equal(ageBucket(14), '14-29');
  assert.equal(ageBucket(29), '14-29');
  assert.equal(ageBucket(30), '30+');
  assert.equal(ageBucket(365), '30+');
});

test('every bucket is reachable and only the last three are returning', () => {
  const reached = new Set([0, 2, 5, 10, 20, 40].map(ageBucket));
  assert.deepEqual([...reached].sort(), [...AGE_BUCKETS].sort());
  assert.deepEqual([...RETURNING_BUCKETS].sort(), ['14-29', '30+', '7-13']);
});

test('days are whole UTC days, not wall-clock hours', () => {
  assert.equal(daysBetween('2026-10-30', '2026-10-31'), 1);
  assert.equal(daysBetween('2026-10-31', '2026-10-30'), 0);
  assert.equal(daysBetween('2026-10-30', '2026-11-06'), 7);
  assert.equal(daysBetween('not-a-day', '2026-11-06'), 0);
});
