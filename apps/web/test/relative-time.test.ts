import assert from 'node:assert/strict';
import { test } from 'node:test';

import { relativeTime } from '../src/utils/relative-time.ts';

const now = Date.UTC(2026, 9, 30, 12, 0, 0);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (ms: number) => relativeTime(now - ms, now);

test('the first seconds are now, not zero minutes', () => {
  assert.deepEqual(ago(0), { unit: 'now', value: 0 });
  assert.deepEqual(ago(44_999), { unit: 'now', value: 0 });
  assert.deepEqual(ago(45_000), { unit: 'minute', value: 1 });
});

test('minutes round down and never read as zero', () => {
  assert.deepEqual(ago(90_000), { unit: 'minute', value: 1 });
  assert.deepEqual(ago(59 * MINUTE), { unit: 'minute', value: 59 });
});

test('the hour boundary is exact', () => {
  assert.deepEqual(ago(HOUR - 1), { unit: 'minute', value: 59 });
  assert.deepEqual(ago(HOUR), { unit: 'hour', value: 1 });
  assert.deepEqual(ago(23 * HOUR), { unit: 'hour', value: 23 });
});

test('days stop at a week, weeks at a month, months at a year', () => {
  assert.deepEqual(ago(DAY), { unit: 'day', value: 1 });
  assert.deepEqual(ago(6 * DAY), { unit: 'day', value: 6 });
  assert.deepEqual(ago(7 * DAY), { unit: 'week', value: 1 });
  assert.deepEqual(ago(29 * DAY), { unit: 'week', value: 4 });
  assert.deepEqual(ago(30 * DAY), { unit: 'month', value: 1 });
  assert.deepEqual(ago(364 * DAY), { unit: 'month', value: 12 });
  assert.deepEqual(ago(365 * DAY), { unit: 'year', value: 1 });
  assert.deepEqual(ago(3 * 365 * DAY), { unit: 'year', value: 3 });
});

test('a stamp from the future reads as now, not as a negative count', () => {
  assert.deepEqual(relativeTime(now + 5 * MINUTE, now), { unit: 'now', value: 0 });
});

test('a missing stamp reads as now instead of NaN', () => {
  assert.deepEqual(relativeTime(Number.NaN, now), { unit: 'now', value: 0 });
});
