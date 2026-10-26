import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatCountdown,
  secondsLeft,
  sleepEndsAt,
} from '../src/utils/sleep-timer.ts';

test('a chosen duration becomes an end timestamp', () => {
  assert.equal(sleepEndsAt(30, 1_000_000), 1_000_000 + 30 * 60_000);
  assert.equal(sleepEndsAt(0, 1_000_000), null);
  assert.equal(sleepEndsAt(-5), null);
  assert.equal(sleepEndsAt(Number.NaN), null);
});

test('the countdown never goes negative', () => {
  assert.equal(secondsLeft(null), 0);
  assert.equal(secondsLeft(1_060_000, 1_000_000), 60);
  assert.equal(secondsLeft(999_000, 1_000_000), 0);
});

test('formatCountdown reads like a clock', () => {
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(59), '0:59');
  assert.equal(formatCountdown(1453), '24:13');
  assert.equal(formatCountdown(3720), '1:02:00');
});
