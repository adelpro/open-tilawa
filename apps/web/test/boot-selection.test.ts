import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bootSelection } from '../src/utils/boot-selection.ts';
import type { Reciter } from '../src/types/reciter.ts';

/**
 * What the player selects when the app opens.
 *
 * The bug this file exists for: a `/listen/<slug>/<n>` link set the reciter and the
 * surah, and then this boot step — which restores "where you stopped" — overwrote both
 * with the stored values. Every link from the surah pages landed on Al-Fatihah.
 */

const reciter = (id: number, slug: string): Reciter => ({
  id,
  name: `reciter-${id}`,
  magnet: `magnet:?xt=urn:btih:${String(id).repeat(40).slice(0, 40)}`,
  riwaya: 'Hafs',
  complet: true,
  slug,
});

const roster = [reciter(4, 'abdulbasit'), reciter(9, 'maher')];

test('the address wins: a listen link is not booted over', () => {
  const choice = bootSelection({
    route: { name: 'listen', release: 'maher', surah: 36, surahName: 'ya-sin' },
    reciters: roster,
    storedReciterId: 4,
    storedSurahId: 2,
    savedPositionFor: () => ({ surahId: 2 }),
  });

  assert.equal(choice, null);
});

test('an ordinary open restores the reciter and the surah that were last used', () => {
  const choice = bootSelection({
    route: { name: 'home' },
    reciters: roster,
    storedReciterId: 9,
    storedSurahId: 36,
    savedPositionFor: () => undefined,
  });

  assert.deepEqual(choice, { reciter: roster[1], surahId: 36 });
});

test('nothing stored means the first reciter, and the first surah', () => {
  const choice = bootSelection({
    route: { name: 'home' },
    reciters: roster,
    savedPositionFor: () => undefined,
  });

  assert.deepEqual(choice, { reciter: roster[0], surahId: 1 });
});

test('the last surah belongs to its reciter: another reciter starts the first harmless one', () => {
  // The stored surah was a position inside reciter 9's release. Opening under a
  // reciter the catalogue no longer lists must not carry that surah over.
  const choice = bootSelection({
    route: { name: 'home' },
    reciters: roster,
    storedReciterId: 99,
    storedSurahId: 36,
    savedPositionFor: () => undefined,
  });

  assert.deepEqual(choice, { reciter: roster[0], surahId: 1 });
});

test('a saved position inside the reciter wins over the last surah', () => {
  const choice = bootSelection({
    route: { name: 'home' },
    reciters: roster,
    storedReciterId: 9,
    storedSurahId: 36,
    savedPositionFor: (id) => (id === 9 ? { surahId: 55 } : undefined),
  });

  assert.deepEqual(choice, { reciter: roster[1], surahId: 55 });
});

test('no roster yet is no choice at all', () => {
  assert.equal(
    bootSelection({
      route: { name: 'home' },
      reciters: [],
      storedReciterId: 9,
      savedPositionFor: () => undefined,
    }),
    null,
  );
});
