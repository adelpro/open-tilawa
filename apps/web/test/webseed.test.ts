import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mediaBase, mediaUrl, shouldAddWebSeed } from '../src/utils/webseed.ts';

test('the web seed waits out the grace period with no peers', () => {
  const base = { ready: true, peers: 0, progress: 0, waitedMs: 8000, alreadyAdded: false };
  assert.equal(shouldAddWebSeed(base), true);
  assert.equal(shouldAddWebSeed({ ...base, waitedMs: 7999 }), false);
  assert.equal(shouldAddWebSeed({ ...base, peers: 1 }), false);
  assert.equal(shouldAddWebSeed({ ...base, ready: false }), false);
  assert.equal(shouldAddWebSeed({ ...base, progress: 1 }), false);
  assert.equal(shouldAddWebSeed({ ...base, alreadyAdded: true }), false);
});

test('media URLs match the torrent layout', () => {
  assert.equal(mediaBase('https://tilawa.quran.us.kg'), 'https://tilawa.quran.us.kg/media/');
  assert.equal(
    mediaUrl('https://tilawa.quran.us.kg', 'Quran-MP3-Ghamdi', 2),
    'https://tilawa.quran.us.kg/media/Quran-MP3-Ghamdi/002.mp3',
  );
  assert.equal(
    mediaUrl(
      'https://tilawa.quran.us.kg',
      'The Holy Quran MP3 recited by Mishary Rashid Al Afasy',
      114,
    ),
    'https://tilawa.quran.us.kg/media/The%20Holy%20Quran%20MP3%20recited%20by%20Mishary%20Rashid%20Al%20Afasy/114.mp3',
  );
});
