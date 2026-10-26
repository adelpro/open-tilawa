import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shouldShowRing } from '../src/utils/stream-ring.ts';

test('the ring only speaks for a torrent that is part-way', () => {
  assert.equal(shouldShowRing('connected', 0.42), true);
  assert.equal(shouldShowRing('waiting', 0.05), true);
  assert.equal(shouldShowRing('connected', 0), false);
  assert.equal(shouldShowRing('connected', 0.004), false);
  assert.equal(shouldShowRing('connected', 1), false);
  assert.equal(shouldShowRing('connected', Number.NaN), false);
});

test('a host-served reciter never gets a torrent ring', () => {
  assert.equal(shouldShowRing('http', 0.5), false);
});
