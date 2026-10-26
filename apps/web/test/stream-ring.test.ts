import assert from 'node:assert/strict';
import { test } from 'node:test';

import { shouldShowRing } from '../src/utils/stream-ring.ts';

test('a torrent always gets a ring, even before the first byte', () => {
  assert.equal(shouldShowRing('waiting'), true);
  assert.equal(shouldShowRing('connected'), true);
});

test('a host-served reciter never gets one', () => {
  assert.equal(shouldShowRing('http'), false);
});
