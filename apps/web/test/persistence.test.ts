import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_STATE,
  isStoredState,
  migrateLegacy,
  migrateV2,
  trimPositions,
} from '../src/hooks/use-persistence.ts';

test('v1 flat state becomes a per-reciter map', () => {
  const state = migrateLegacy({ reciterId: 3, surahIndex: 17, position: 42, updatedAt: 10 }, {});
  assert.equal(state.version, 3);
  assert.equal(state.reciterId, 3);
  assert.equal(state.lastSurahId, 18);
  assert.deepEqual(state.positions['3'], { surahId: 18, position: 42, updatedAt: 10 });
});

test('v1 per-reciter progress keys are rescued', () => {
  const state = migrateLegacy(null, {
    '5': { surahIndex: 0, position: 12, updatedAt: 5 },
    '7': { surahIndex: 35, position: 0 },
  });
  assert.equal(state.positions['5'].surahId, 1);
  assert.equal(state.positions['7'].surahId, 36);
  assert.equal(state.positions['7'].position, 0);
});

test('unknown legacy shapes degrade to defaults', () => {
  const state = migrateLegacy(null, { '9': {} as never });
  assert.equal(state.version, 3);
  assert.deepEqual(state.positions, {});
  assert.deepEqual(state.settings, {});
});

test('v2 moves its loose settings into one bag', () => {
  const state = migrateV2({
    version: 2,
    reciterId: 11,
    positions: { '11': { surahId: 113, position: 4.8, updatedAt: 99 } },
    rate: 1.5,
    visualiser: 'dots',
    locale: 'en',
    theme: 'dark',
    updatedAt: 100,
  });
  assert.ok(state);
  assert.equal(state!.version, 3);
  assert.equal(state!.reciterId, 11);
  assert.equal(state!.lastSurahId, 113);
  assert.deepEqual(state!.settings, { rate: 1.5, visualiser: 'dots', locale: 'en', theme: 'dark' });
});

test('v2 keeps only the keys it understands', () => {
  const state = migrateV2({ version: 2, positions: {}, repeat: 'one', shuffle: true });
  assert.deepEqual(state!.settings, {});
});

test('a blob that is not v2 is refused, so the caller can fall through', () => {
  assert.equal(migrateV2({ version: 1 }), null);
  assert.equal(migrateV2(null), null);
  assert.equal(migrateV2('nope'), null);
});

test('isStoredState accepts v3 only', () => {
  assert.equal(isStoredState({ ...DEFAULT_STATE }), true);
  assert.equal(isStoredState({ version: 2, positions: {} }), false);
  assert.equal(isStoredState(null), false);
});

test('trimPositions keeps the ten newest entries', () => {
  const positions: Record<string, { surahId: number; position: number; updatedAt: number }> = {};
  for (let i = 0; i < 14; i += 1) positions[String(i)] = { surahId: 1, position: i, updatedAt: i };
  const trimmed = trimPositions({ ...DEFAULT_STATE, positions });
  const kept = Object.keys(trimmed.positions);
  assert.equal(kept.length, 10);
  assert.ok(kept.includes('13'));
  assert.ok(!kept.includes('0'));
});
