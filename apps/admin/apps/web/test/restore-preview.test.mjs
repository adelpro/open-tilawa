import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createPreviewGuard } from '../src/lib/restore-preview.ts';

describe('restore preview guard', () => {
  it('drops a reply from a snapshot the dialog is no longer showing', () => {
    const guard = createPreviewGuard();
    guard.begin('a.sqlite');
    guard.begin('b.sqlite');
    assert.equal(guard.apply('a.sqlite', { rows: 3 }), null);
  });

  it('keeps a reply from the snapshot currently shown', () => {
    const guard = createPreviewGuard();
    guard.begin('b.sqlite');
    assert.deepEqual(guard.apply('b.sqlite', { rows: 3 }), { rows: 3 });
  });

  it('drops a reply after the dialog closes', () => {
    const guard = createPreviewGuard();
    guard.begin('a.sqlite');
    guard.clear();
    assert.equal(guard.apply('a.sqlite', { rows: 3 }), null);
  });
});
