import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_STATE,
  isStoredState,
  migrateLegacy,
  trimPositions,
} from '../src/hooks/use-persistence.ts';

test('migrateLegacy turns the v1 flat state into a per-reciter map', () => {
  const state = migrateLegacy({ reciterId: 3, surahIndex: 17, position: 42, updatedAt: 10 }, {});
  assert.equal(state.version, 2);
  assert.equal(state.reciterId, 3);
  // v1 stored a 0-based playlist index; v2 stores the surah id.
  assert.deepEqual(state.positions['3'], { surahId: 18, position: 42, updatedAt: 10 });
});

test('migrateLegacy also rescues the per-reciter progress keys', () => {
  const state = migrateLegacy(null, {
    '5': { surahIndex: 0, position: 12, updatedAt: 5 },
    '7': { surahIndex: 35, position: 0 },
  });
  assert.equal(state.positions['5'].surahId, 1);
  assert.equal(state.positions['7'].surahId, 36);
  assert.equal(state.positions['7'].position, 0);
});

test('migrateLegacy never throws on junk and falls back to defaults', () => {
  const state = migrateLegacy(null, { '9': {} as never });
  assert.equal(state.version, 2);
  assert.deepEqual(state.positions, {});
  assert.equal(state.repeat, 'off');
  assert.equal(state.rate, 1);
  assert.equal(state.theme, 'dark');
});

test('migrateLegacy keeps the legacy position when it is negative', () => {
  const state = migrateLegacy({ reciterId: 1, surahIndex: 4, position: -30 }, {});
  assert.equal(state.positions['1'].position, 0);
});

test('isStoredState accepts only v2 shapes', () => {
  assert.equal(isStoredState({ version: 2, positions: {} }), true);
  assert.equal(isStoredState({ version: 1, positions: {} }), false);
  assert.equal(isStoredState(null), false);
  assert.equal(isStoredState('v2'), false);
});

test('trimPositions keeps the ten most recent reciters', () => {
  const positions = Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [
      String(i),
      { surahId: 1, position: 0, updatedAt: i },
    ]),
  );
  const trimmed = trimPositions({ ...DEFAULT_STATE, positions });
  assert.equal(Object.keys(trimmed.positions).length, 10);
  assert.equal(trimmed.positions['0'], undefined);
  assert.equal(trimmed.positions['1'], undefined);
  assert.ok(trimmed.positions['11']);
});
