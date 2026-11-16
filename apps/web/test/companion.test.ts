import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COMPANION_IDS } from '../src/constants/companion.ts';
import { companionTargets, notifyCompanion, playMessage } from '../src/utils/companion.ts';

const release = {
  infohash: 'A'.repeat(40),
  slug: 'maher-al-muaiqly',
  name: 'Maher_Al-Muaiqly',
  nameAr: 'ماهر المعيقلي',
};

test('the target list carries the live listings only, never an empty id', () => {
  assert.deepEqual(companionTargets({ edge: COMPANION_IDS.edge, chrome: '', firefox: COMPANION_IDS.firefox }), [
    COMPANION_IDS.edge,
    COMPANION_IDS.firefox,
  ]);
  assert.deepEqual(companionTargets({ edge: '', chrome: '', firefox: '  ' }), []);
});

test('the dev build is targeted on staging only, never from production', () => {
  assert.deepEqual(companionTargets(COMPANION_IDS, 'staging.tilawah.cc'), [
    COMPANION_IDS.edge,
    COMPANION_IDS.firefox,
    COMPANION_IDS.dev,
  ]);
  assert.deepEqual(companionTargets(COMPANION_IDS, 'tilawah.cc'), [COMPANION_IDS.edge, COMPANION_IDS.firefox]);
});

test('a play notice is one type and one lowercase hash', () => {
  assert.deepEqual(playMessage(release), {
    type: 'tilawah:play',
    infohash: 'a'.repeat(40),
    slug: 'maher-al-muaiqly',
    name: 'Maher_Al-Muaiqly',
    nameAr: 'ماهر المعيقلي',
  });
});

test('a release without a real infohash sends nothing', () => {
  assert.equal(playMessage({ ...release, infohash: 'short' }), null);
  assert.equal(playMessage({ ...release, infohash: 'g'.repeat(40) }), null);
  assert.equal(playMessage({ ...release, infohash: '' }), null);
});

test('without a window — the prerender, or any non-browser run — sending is a silent no-op', () => {
  // Node has no `window`; this must return without throwing, because the site
  // prerenders this component tree at build time.
  assert.doesNotThrow(() => notifyCompanion(release));
});
