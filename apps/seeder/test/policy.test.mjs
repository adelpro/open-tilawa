import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exactLengthFromMagnet, fits, quotaFromEnv } from '../lib/policy.mjs';

test('quota comes from MAX_DISK_BYTES first, then DISK_QUOTA_GB, else unlimited', () => {
  assert.equal(quotaFromEnv({ MAX_DISK_BYTES: '1024' }), 1024);
  assert.equal(quotaFromEnv({ DISK_QUOTA_GB: '2' }), 2 * 1024 ** 3);
  assert.equal(quotaFromEnv({ MAX_DISK_BYTES: '1024', DISK_QUOTA_GB: '2' }), 1024);
  assert.equal(quotaFromEnv({}), 0);
  assert.equal(quotaFromEnv({ DISK_QUOTA_GB: 'nope' }), 0);
});

test('a release that fits the quota is accepted', () => {
  const decision = fits({ quotaBytes: 1000, usedBytes: 200, incomingBytes: 500 });
  assert.equal(decision.ok, true);
  assert.equal(decision.headroomBytes, 800);
});

test('the quota is the stricter bound when the disk is roomy', () => {
  const decision = fits({ quotaBytes: 1000, usedBytes: 900, incomingBytes: 200, freeBytes: 1e12 });
  assert.deepEqual(decision, { ok: false, reason: 'quota', headroomBytes: 100 });
});

test('the filesystem is the stricter bound when it is nearly full', () => {
  const decision = fits({
    quotaBytes: 10 * 1024 ** 3,
    usedBytes: 0,
    incomingBytes: 2 * 1024 ** 3,
    freeBytes: 1024 ** 3,
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, 'disk');
});

test('the reserve is kept free', () => {
  const decision = fits({
    quotaBytes: 0,
    usedBytes: 0,
    incomingBytes: 900,
    freeBytes: 1000,
    reserveBytes: 200,
  });
  assert.equal(decision.ok, false);
  assert.equal(decision.reason, 'disk');
});

test('an unknown size does not block, and unlimited quota never does', () => {
  assert.equal(fits({ quotaBytes: 0, usedBytes: 10, incomingBytes: 0, freeBytes: 1e12 }).ok, true);
});

test('xl is read from the magnet and ignored when absent or invalid', () => {
  assert.equal(exactLengthFromMagnet('magnet:?xt=urn:btih:abc&xl=12345'), 12345);
  assert.equal(exactLengthFromMagnet('magnet:?xt=urn:btih:abc'), 0);
  assert.equal(exactLengthFromMagnet('not-a-magnet'), 0);
});
