import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatBytes, formatSpeed } from '../src/utils/format-bytes.ts';

test('formatBytes covers the whole ladder', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 ** 2), '5.0 MB');
  assert.equal(formatBytes(1024 ** 3), '1.0 GB');
  assert.equal(formatBytes(null), '—');
  assert.equal(formatBytes(undefined), '—');
  assert.equal(formatBytes(Number.NaN), '—');
});

test('formatSpeed keeps a stalled transfer a real speed', () => {
  assert.equal(formatSpeed(0), '0 B/s');
  assert.equal(formatSpeed(2.5 * 1024 ** 2), '2.5 MB/s');
  assert.equal(formatSpeed(null), '—');
});

// WebTorrent reports fractional speeds (0.8 B/s). A negative exponent indexed
// past the start of UNITS and printed "819 undefined/s".
test('sub-byte sizes and rates stay at zero, never a phantom unit', () => {
  assert.equal(formatBytes(0.8), '0 B');
  assert.equal(formatSpeed(0.8), '0 B/s');
});
