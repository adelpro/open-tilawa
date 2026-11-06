import assert from 'node:assert/strict';
import { test } from 'node:test';

import { siteManifest } from '../src/utils/site-version.ts';

/**
 * The manifest is the only record of what the deployed HTML contains. The console
 * diffs it against the live catalogue to decide whether the site needs a rebuild,
 * so it must name exactly what the page prints: the Arabic name when there is one,
 * else the torrent name, plus the riwaya the row carries.
 */
test('the manifest names each release the way the page prints it', () => {
  const manifest = siteManifest(
    [
      {
        slug: 'yassine-el-jazairi-warsh',
        name: 'Yassine_El_Jazairi_Warsh',
        nameAr: 'ياسين الجزائري',
        riwaya: 'Warsh',
      },
      {
        slug: 'maher-al-muaiqly',
        name: 'Maher_Al-Muaiqly',
        nameAr: null,
        riwaya: 'Hafs',
      },
    ],
    '2026-11-06T10:00:00.000Z',
  );

  assert.deepEqual(manifest, {
    builtAt: '2026-11-06T10:00:00.000Z',
    releases: [
      { slug: 'maher-al-muaiqly', name: 'Maher_Al-Muaiqly', riwaya: 'Hafs' },
      { slug: 'yassine-el-jazairi-warsh', name: 'ياسين الجزائري', riwaya: 'Warsh' },
    ],
  });
});

test('a row with no slug has no page to compare', () => {
  const manifest = siteManifest(
    [{ slug: '', name: 'Draft', nameAr: null, riwaya: 'unknown' }],
    '2026-11-06T10:00:00.000Z',
  );

  assert.deepEqual(manifest.releases, []);
});

test('the order is stable by slug, not by the API page order', () => {
  const manifest = siteManifest(
    [
      { slug: 'z-last', name: 'Z', nameAr: null, riwaya: 'Hafs' },
      { slug: 'a-first', name: 'A', nameAr: null, riwaya: 'Hafs' },
    ],
    '2026-11-06T10:00:00.000Z',
  );

  assert.deepEqual(
    manifest.releases.map((release) => release.slug),
    ['a-first', 'z-last'],
  );
});
