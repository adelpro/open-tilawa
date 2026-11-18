import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sourceHealth } from '../src/lib/backup-sources.ts';

const now = Date.parse('2026-11-18T12:00:00.000Z');

describe('source health view', () => {
  it('says not checked when the target has no result', () => {
    assert.deepEqual(sourceHealth({ lastState: null, lastCheckedAt: null }, now), {
      key: 'never',
      at: null,
      stale: false,
    });
  });

  it('calls a recent ok result healthy', () => {
    const result = sourceHealth(
      { lastState: 'ok', lastCheckedAt: '2026-11-18T11:00:00.000Z' },
      now,
    );
    assert.equal(result.key, 'ok');
    assert.equal(result.stale, false);
  });

  it('calls an ok result older than 26 hours stale', () => {
    const result = sourceHealth(
      { lastState: 'ok', lastCheckedAt: '2026-11-16T00:00:00.000Z' },
      now,
    );
    assert.equal(result.key, 'stale');
    assert.equal(result.stale, true);
  });

  it('keeps a failure a failure even when it is old', () => {
    const result = sourceHealth(
      { lastState: 'failed', lastCheckedAt: '2026-11-16T00:00:00.000Z' },
      now,
    );
    assert.equal(result.key, 'failed');
  });
});
