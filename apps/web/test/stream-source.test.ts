import assert from 'node:assert/strict';
import { test } from 'node:test';

import { iconForSource } from '../src/utils/stream-source.ts';

test('each stream state has exactly one glyph, shared by every surface', () => {
  assert.equal(iconForSource('waiting'), 'wifi-waiting');
  assert.equal(iconForSource('connected'), 'wifi');
  assert.equal(iconForSource('webseed'), 'server');
  // The drift this map removes: the footer drew `wifi` for a mixed stream
  // while the sheet drew `server`.
  assert.equal(iconForSource('mixed'), 'server');
});
