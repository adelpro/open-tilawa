import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cleanName, episodeOf, planRename } from '../lib/normalise.mjs';

test('reads the episode from a leading number or from inside the name', () => {
  assert.equal(episodeOf('001.mp3'), 1);
  assert.equal(episodeOf('ar_001_Yassine_El_Jazairi_Warsh.mp3'), 1);
  assert.equal(episodeOf('114.mp3'), 114);
  assert.equal(episodeOf('cover.jpg'), null);
});

test('renames the varied sources to one convention', () => {
  const plan = planRename([
    'ar_001_Yassine.mp3',
    'ar_002_Yassine.mp3',
  ]);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.rename, [
    { from: 'ar_001_Yassine.mp3', to: '001.mp3' },
    { from: 'ar_002_Yassine.mp3', to: '002.mp3' },
  ]);
  assert.equal(plan.count, 2);
});

test('leaves an already-normalised folder alone', () => {
  const plan = planRename(['001.mp3', '002.mp3', '003.mp3']);
  assert.equal(plan.ok, true);
  assert.ok(plan.rename.every(({ from, to }) => from === to));
});

test('drops everything that is not the mushaf', () => {
  const plan = planRename(['001.mp3', 'MP3Quran.gif', 'MP3Quran.net.txt', '.DS_Store']);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.drop.sort(), ['.DS_Store', 'MP3Quran.gif', 'MP3Quran.net.txt']);
  assert.equal(plan.count, 1);
});

test('refuses a folder with a gap in the numbering', () => {
  const plan = planRename(['001.mp3', '003.mp3']);
  assert.equal(plan.ok, false);
  assert.match(plan.error, /not contiguous/);
});

test('refuses a folder where one episode appears twice', () => {
  const plan = planRename(['001.mp3', 'ar_001_other.mp3']);
  assert.equal(plan.ok, false);
  assert.match(plan.error, /appears twice/);
});

test('refuses a folder with no mp3 at all', () => {
  const plan = planRename(['cover.jpg']);
  assert.equal(plan.ok, false);
  assert.match(plan.error, /no mp3/);
});

test('drops the source site tags from a release name', () => {
  assert.equal(cleanName('Maher_Al-Muaiqly_(MP3_Quran)'), 'Maher_Al-Muaiqly');
  assert.equal(
    cleanName('Abdulbasit_Abdulsamad_Mojawwad_(MP3_Quran)'),
    'Abdulbasit_Abdulsamad_Mojawwad',
  );
  assert.equal(cleanName('Khalid_Aljleel_Update2_(MP3_Quran)'), 'Khalid_Aljleel');
});

test('leaves a name that carries no source tags alone', () => {
  assert.equal(cleanName('Yassine_El_Jazairi_Warsh'), 'Yassine_El_Jazairi_Warsh');
});
