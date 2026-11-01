import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  mediaBase,
  mediaFileUrl,
  mediaUrlForFile,
  shouldAddWebSeed,
  shouldRetryDirect,
} from '../src/utils/webseed.ts';

test('the web seed waits for silence, not for an empty swarm', () => {
  const base = { ready: true, idle: false, stalledMs: 8000, alreadyAdded: false };
  assert.equal(shouldAddWebSeed(base), true);
  assert.equal(shouldAddWebSeed({ ...base, stalledMs: 7999 }), false);
  assert.equal(shouldAddWebSeed({ ...base, ready: false }), false);
  assert.equal(shouldAddWebSeed({ ...base, alreadyAdded: true }), false);
});

test('a connected peer that sends nothing does not hold the fallback back', () => {
  // The old predicate required `peers === 0`, and WebTorrent counts every wire,
  // so one idle or leeching peer kept the seed off for the whole session. Peer
  // count is not part of the decision any more: only delivered bytes are.
  assert.equal(
    shouldAddWebSeed({ ready: true, idle: false, stalledMs: 30_000, alreadyAdded: false }),
    true,
  );
});

test('a paused, buffered player is silence by design, not a stall', () => {
  assert.equal(
    shouldAddWebSeed({ ready: true, idle: true, stalledMs: 60_000, alreadyAdded: false }),
    false,
  );
});

test('media URLs match the torrent layout', () => {
  assert.equal(mediaBase('https://tilawa.quran.us.kg'), 'https://tilawa.quran.us.kg/media/');
  assert.equal(
    mediaBase('https://tilawa.quran.us.kg/'),
    'https://tilawa.quran.us.kg/media/',
  );
  assert.equal(
    mediaFileUrl('https://tilawa.quran.us.kg', 'Quran-MP3-Ghamdi', '002.mp3'),
    'https://tilawa.quran.us.kg/media/Quran-MP3-Ghamdi/002.mp3',
  );
  assert.equal(
    mediaFileUrl(
      'https://tilawa.quran.us.kg',
      'The Holy Quran MP3 recited by Mishary Rashid Al Afasy',
      '114.mp3',
    ),
    'https://tilawa.quran.us.kg/media/The%20Holy%20Quran%20MP3%20recited%20by%20Mishary%20Rashid%20Al%20Afasy/114.mp3',
  );
});

test('a named file resolves to the same torrent layout', () => {
  // The catalogue is not uniformly `001.mp3`: some reciters ship `ar_001_Name.mp3`,
  // so the direct fallback has to carry the file's real name, not a rebuilt one.
  assert.equal(
    mediaFileUrl('https://tilawah.cc', 'Quran-MP3-Ghamdi', 'ar_001_Al-Fatiha.mp3'),
    'https://tilawah.cc/media/Quran-MP3-Ghamdi/ar_001_Al-Fatiha.mp3',
  );
  assert.equal(
    mediaFileUrl('https://tilawah.cc/', 'Quran MP3', '002.mp3'),
    'https://tilawah.cc/media/Quran%20MP3/002.mp3',
  );
});

test('a torrent file resolves to its own name, or not at all', () => {
  assert.equal(
    mediaUrlForFile('https://tilawah.cc', 'Quran-MP3-Ghamdi', { name: 'ar_001_Al-Fatiha.mp3' }),
    'https://tilawah.cc/media/Quran-MP3-Ghamdi/ar_001_Al-Fatiha.mp3',
  );
  // A URL is never invented from half a path.
  assert.equal(mediaUrlForFile('https://tilawah.cc', undefined, { name: '001.mp3' }), undefined);
  assert.equal(mediaUrlForFile('https://tilawah.cc', 'Quran-MP3-Ghamdi', {}), undefined);
  assert.equal(mediaUrlForFile('https://tilawah.cc', 'Quran-MP3-Ghamdi', null), undefined);
});

test('only a source-level failure is retried against the direct file', () => {
  const base = { code: 4, alreadyTried: false };
  assert.equal(shouldRetryDirect(base), true);
  // A decode error means the bytes arrived and were unusable: the same bytes
  // from the web seed fail identically, so re-pointing the element only stalls.
  assert.equal(shouldRetryDirect({ ...base, code: 3 }), false);
  assert.equal(shouldRetryDirect({ ...base, code: 2 }), false);
  assert.equal(shouldRetryDirect({ ...base, code: 1 }), false);
  assert.equal(shouldRetryDirect({ ...base, code: undefined }), false);
  // One retry per surah: a second failure is the real error.
  assert.equal(shouldRetryDirect({ ...base, alreadyTried: true }), false);
});
