import { describe, expect, test } from 'vitest';

import { sanitizeHeld, stateFor, torrentUrl, type HeldReciter } from '../src/lib/engine';

const reciter = (over: Partial<HeldReciter> = {}): HeldReciter => ({
  infohash: 'a'.repeat(40),
  slug: 'maher',
  name: 'Maher_Al-Muaiqly',
  nameAr: 'ماهر المعيقلي',
  riwaya: 'Hafs',
  sizeBytes: 1_303_630_233,
  surahs: null,
  swarm: null,
  complete: true,
  addedAt: '2026-11-15T00:00:00Z',
  source: 'manual',
  ...over,
});

describe('torrentUrl', () => {
  test('is absolute, lowercased, and points at the published file', () => {
    expect(torrentUrl('AB'.repeat(20))).toBe(`https://tilawah.cc/torrents/${'ab'.repeat(20)}.torrent`);
  });
});

describe('sanitizeHeld', () => {
  test('a held row with no infohash is skipped and the others survive', () => {
    const list = sanitizeHeld([{ infohash: 'zzz' }, reciter()]);

    expect(list).toHaveLength(1);
    expect(list[0]!.slug).toBe('maher');
  });

  test('junk that is not an object is skipped, not thrown on', () => {
    expect(sanitizeHeld([null, 7, 'x', reciter()])).toHaveLength(1);
  });

  test('a duplicate infohash is kept once', () => {
    expect(sanitizeHeld([reciter(), reciter({ addedAt: '2026-11-16T00:00:00Z' })])).toHaveLength(1);
  });
});

describe('stateFor', () => {
  test('a completed torrent is seeding even with no peers', () => {
    expect(stateFor({ progress: 1, numPeers: 0, paused: false, ready: true })).toBe('seeding');
  });

  test('a partial torrent with peers is downloading', () => {
    expect(stateFor({ progress: 0.42, numPeers: 3, paused: false, ready: true })).toBe('downloading');
  });

  test('metadata not yet arrived is queued, not downloading', () => {
    expect(stateFor({ progress: 0, numPeers: 0, paused: false, ready: false })).toBe('queued');
  });

  test('paused beats the byte count, and an error beats everything', () => {
    expect(stateFor({ progress: 0.5, numPeers: 3, paused: true, ready: true })).toBe('paused');
    expect(stateFor({ progress: 0.1, numPeers: 0, paused: false, ready: true, error: new Error('x') })).toBe('error');
  });
});
