import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateBytes, sumBytes, trackFileName, validateTracks } from '../lib/import.mjs';

const track = (surah, sizeBytes = 1000) => ({
  surah,
  url: `https://example.test/${surah}.mp3`,
  sizeBytes,
});

describe('import job input', () => {
  it('accepts 114 ordered tracks', () => {
    const tracks = Array.from({ length: 114 }, (_, index) => track(index + 1));
    assert.deepEqual(validateTracks(tracks), { ok: true });
  });

  it('accepts a partial recitation, because providers carry them', () => {
    const tracks = Array.from({ length: 16 }, (_, index) => track(index + 1));
    assert.deepEqual(validateTracks(tracks), { ok: true });
  });

  it('refuses a missing or duplicated surah', () => {
    assert.equal(validateTracks([track(1), track(1)]).ok, false);
    assert.equal(validateTracks([track(0)]).ok, false);
    assert.equal(validateTracks([track(115)]).ok, false);
    assert.equal(validateTracks([]).ok, false);
  });

  it('refuses a track that is not an http(s) URL', () => {
    assert.equal(validateTracks([{ ...track(1), url: 'file:///etc/passwd' }]).ok, false);
  });

  it('names every file with three digits, as the media route expects', () => {
    assert.equal(trackFileName(1), '001.mp3');
    assert.equal(trackFileName(114), '114.mp3');
  });

  it('sums known sizes and falls back to the estimate only when all are unknown', () => {
    assert.equal(sumBytes([track(1, 10), track(2, 20)]), 30);
    assert.equal(estimateBytes([track(1, 10), track(2, 20)], 999), 30);
    assert.equal(estimateBytes([track(1, null), track(2, null)], 999), 999);
  });
});
