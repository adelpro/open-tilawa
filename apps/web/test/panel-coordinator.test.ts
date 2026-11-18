import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPlayerScreen,
  planLeaveOverlays,
  planOpenAccountPanel,
  planOpenPlayerSheet,
  routeIdentity,
} from '@/utils/panel-coordinator';

test('player routes mount PlayerPage while subpages and missing deep links do not', () => {
  assert.equal(isPlayerScreen({ name: 'home' }), true);
  assert.equal(isPlayerScreen({ name: 'listen', release: 'minshawi', surah: 18, surahName: 'al-kahf' }), true);
  assert.equal(isPlayerScreen({ name: 'listen', release: 'missing', surah: 1, surahName: '' }, true), false);
  assert.equal(isPlayerScreen({ name: 'reciter', slug: 'abdelaziz-sheim' }), false);
  assert.equal(isPlayerScreen({ name: 'reciters' }), false);
  assert.equal(isPlayerScreen({ name: 'settings' }), false);
  assert.equal(isPlayerScreen({ name: 'about' }), false);
  assert.equal(isPlayerScreen({ name: 'notFound' }), false);
});

test('opening a player sheet from the player screen closes account/menu without navigating', () => {
  assert.deepEqual(planOpenPlayerSheet('reciters', { name: 'home' }), {
    sheet: 'reciters',
    accountOpen: false,
    menuOpen: false,
    navigateTo: null,
  });

  assert.deepEqual(
    planOpenPlayerSheet('surahs', { name: 'listen', release: 'minshawi', surah: 1, surahName: '' }),
    {
      sheet: 'surahs',
      accountOpen: false,
      menuOpen: false,
      navigateTo: null,
    },
  );
});

test('opening a player sheet from a non-player page navigates home so the sheet mounts', () => {
  for (const route of [
    { name: 'reciter', slug: 'abdelaziz-sheim' } as const,
    { name: 'reciters' } as const,
    { name: 'settings' } as const,
    { name: 'about' } as const,
  ]) {
    assert.deepEqual(planOpenPlayerSheet('surahs', route), {
      sheet: 'surahs',
      accountOpen: false,
      menuOpen: false,
      navigateTo: { name: 'home' },
    });
  }

  assert.deepEqual(
    planOpenPlayerSheet('reciters', { name: 'listen', release: 'unknown', surah: 1, surahName: '' }, true),
    {
      sheet: 'reciters',
      accountOpen: false,
      menuOpen: false,
      navigateTo: { name: 'home' },
    },
  );
});

test('opening the account panel clears any stacked player sheet or nav menu', () => {
  assert.deepEqual(planOpenAccountPanel(), {
    sheet: null,
    accountOpen: true,
    menuOpen: false,
  });
});

test('leaving overlays dismisses account and unpinned sheets while preserving pinned panels', () => {
  assert.deepEqual(planLeaveOverlays('surahs', false), {
    sheet: null,
    accountOpen: false,
    menuOpen: false,
  });
  assert.deepEqual(planLeaveOverlays('reciters', true), {
    sheet: 'reciters',
    accountOpen: false,
    menuOpen: false,
  });
});

test('routeIdentity ignores surahName decoration on listen links', () => {
  assert.equal(
    routeIdentity({ name: 'listen', release: 'minshawi', surah: 18, surahName: 'stale' }),
    routeIdentity({ name: 'listen', release: 'minshawi', surah: 18, surahName: '' }),
  );
  assert.notEqual(
    routeIdentity({ name: 'reciter', slug: 'a' }),
    routeIdentity({ name: 'reciter', slug: 'b' }),
  );
});
