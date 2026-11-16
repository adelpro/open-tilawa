import { describe, expect, test } from 'vitest';

import { followAdd, parsePlayMessage, playingNow, type FollowInput } from '../src/lib/follow';
import type { HeldReciter } from '../src/lib/catalogue';

const NOW = 1_800_000_000_000;
const hash = (c: string) => c.repeat(40);

const held = (letter: string, source: HeldReciter['source'] = 'manual', ageMs = 0): HeldReciter => ({
  id: undefined,
  infohash: hash(letter),
  slug: `reciter-${letter}`,
  name: `Reciter ${letter.toUpperCase()}`,
  nameAr: 'قارئ',
  riwaya: 'Hafs',
  sizeBytes: 1_000,
  surahs: null,
  complete: true,
  addedAt: new Date(NOW - 100_000 - ageMs).toISOString(),
  source,
});

const row = (letter: string) => ({
  infohash: hash(letter),
  slug: `reciter-${letter}`,
  name: `Reciter ${letter.toUpperCase()}`,
  nameAr: 'قارئ',
  riwaya: 'Hafs',
  sizeBytes: 1_000,
  surahs: null,
  complete: true,
});

const add = (over: Partial<FollowInput> = {}) =>
  followAdd({
    held: [],
    row: row('n'),
    mode: 'mixed',
    followCap: 2,
    now: NOW,
    playing: new Set<string>(),
    ...over,
  });

describe('followAdd', () => {
  test('a new reciter is added at the front with a follow source', () => {
    const { held: next, added, evicted } = add({ held: [held('a')], row: row('n') });
    expect(added).toBe(true);
    expect(evicted).toEqual([]);
    expect(next[0]?.infohash).toBe(hash('n'));
    expect(next[0]?.source).toBe('follow');
    expect(next[0]?.addedAt).toBe(new Date(NOW).toISOString());
    expect(next).toHaveLength(2);
  });

  test('manual mode follows nothing', () => {
    const { held: next, added } = add({ held: [held('a')], mode: 'manual' });
    expect(added).toBe(false);
    expect(next).toHaveLength(1);
  });

  test('a follow cap of zero disables following', () => {
    const { held: next, added } = add({ followCap: 0 });
    expect(added).toBe(false);
    expect(next).toHaveLength(0);
  });

  test('a reciter already held as a manual choice is never touched', () => {
    const manual = held('a');
    const { held: next, added, evicted } = add({ held: [manual], row: row('a') });
    expect(added).toBe(false);
    expect(evicted).toEqual([]);
    expect(next[0]).toEqual(manual);
  });

  test('the same reciter played again refreshes recency and moves to the front, once', () => {
    const older = { ...held('n', 'follow', 500_000) };
    const { held: next, added, evicted } = add({ held: [held('b', 'follow'), older], row: row('n') });
    expect(added).toBe(true);
    expect(evicted).toEqual([]);
    expect(next).toHaveLength(2);
    expect(next[0]?.infohash).toBe(hash('n'));
    expect(next[0]?.addedAt).toBe(new Date(NOW).toISOString());
    expect(next.filter((entry) => entry.infohash === hash('n'))).toHaveLength(1);
  });

  test('eviction past the cap removes the oldest follow entry, never a manual one', () => {
    const heldList = [held('m', 'manual', 900_000), held('c', 'follow', 800_000), held('b', 'follow', 700_000)];
    const { held: next, evicted } = add({ held: heldList, row: row('n') });
    expect(evicted).toEqual([hash('c')]);
    expect(next.map((entry) => entry.infohash)).toEqual([hash('n'), hash('m'), hash('b')]);
    expect(next.find((entry) => entry.infohash === hash('m'))?.source).toBe('manual');
  });

  test('eviction skips a reciter that is playing right now', () => {
    const heldList = [held('c', 'follow', 800_000), held('b', 'follow', 700_000)];
    const { held: next, evicted } = add({
      held: heldList,
      row: row('n'),
      playing: new Set([hash('c')]),
    });
    expect(evicted).toEqual([hash('b')]);
    expect(next.find((entry) => entry.infohash === hash('c'))).toBeTruthy();
    // The protected row keeps its slot; the cap is met by trimming the rest.
    expect(next).toHaveLength(2);
  });

  test('a cap temporarily exceeded when everything old is playing is trimmed on the next add', () => {
    const playing = new Set([hash('c'), hash('b')]);
    // Three follow entries under a cap of two: both old ones are playing, so
    // the add is accepted and the trim waits.
    const first = add({
      held: [held('c', 'follow', 800_000), held('b', 'follow', 700_000)],
      row: row('n'),
      playing,
    });
    expect(first.added).toBe(true);
    expect(first.evicted).toEqual([]);
    // Three follow entries under a cap of two: both old ones are protected,
    // so the exceedance is the playing rows' doing and survives.
    expect(first.held.filter((entry) => entry.source === 'follow')).toHaveLength(3);

    // The next add trims the stopped rows instead: the oldest stopped stamp
    // goes, the protected pair stays.
    const second = followAdd({
      held: first.held,
      row: row('x'),
      mode: 'mixed',
      followCap: 2,
      now: NOW + 1_000,
      playing,
    });
    expect(second.evicted).toEqual([hash('n')]);
    expect(second.held.filter((entry) => entry.source === 'follow')).toHaveLength(3);

    // Everything stops: the add trims back to the cap by oldest stamp.
    const third = followAdd({
      held: second.held,
      row: row('y'),
      mode: 'mixed',
      followCap: 2,
      now: NOW + 2_000,
      playing: new Set<string>(),
    });
    expect(third.evicted).toEqual([hash('c'), hash('b')]);
    expect(third.held.filter((entry) => entry.source === 'follow')).toHaveLength(2);
    expect(third.held[0]?.infohash).toBe(hash('y'));
  });

  test('the row just added is never the one evicted', () => {
    const { held: next, evicted } = add({
      held: [held('c', 'follow', 800_000), held('b', 'follow', 700_000)],
      row: row('n'),
    });
    // Two follow entries are already at the cap; the add makes three, and the
    // oldest stamp goes (bigger age = older) — not the reciter this play was about.
    expect(evicted).toEqual([hash('c')]);
    expect(next[0]?.infohash).toBe(hash('n'));
    expect(next).toHaveLength(2);
  });

  test('a disk budget trims follow rows until the bytes fit, and never a manual one', () => {
    // Four rows of 1000 bytes against a 3000-byte budget: the oldest follow
    // entry gives way; the manual pick and the fresh row stay.
    const { held: next, evicted } = add({
      held: [held('m', 'manual', 900_000), held('a', 'follow', 800_000), held('b', 'follow', 700_000)],
      row: row('n'),
      followCap: 6,
      budgetBytes: 3000,
    });
    expect(evicted).toEqual([hash('a')]);
    expect(next.some((entry) => entry.infohash === hash('m'))).toBe(true);
    expect(next.some((entry) => entry.infohash === hash('n'))).toBe(true);
    expect(next).toHaveLength(3);
  });

  test('a budget that only the manual rows exceed leaves them all in place', () => {
    const { held: next, evicted } = add({
      held: [held('m', 'manual', 900_000), held('a', 'follow', 800_000)],
      row: row('n'),
      followCap: 6,
      budgetBytes: 500,
    });
    // Even emptying the follow list cannot fit the manual bytes; the trim
    // removes the old follow entry and stops — never the manual row, and never
    // the row this play just added.
    expect(evicted).toEqual([hash('a')]);
    expect(next.some((entry) => entry.infohash === hash('m') && entry.source === 'manual')).toBe(true);
    expect(next.some((entry) => entry.infohash === hash('n'))).toBe(true);
  });
});

describe('parsePlayMessage', () => {
  test('accepts a play notice and lowercases the hash', () => {
    const parsed = parsePlayMessage({ type: 'tilawah:play', infohash: 'A'.repeat(40) });
    expect(parsed).toEqual({ infohash: hash('a') });
  });

  test('rejects everything that is not exactly a play notice with a real hash', () => {
    expect(parsePlayMessage(null)).toBeNull();
    expect(parsePlayMessage('play')).toBeNull();
    expect(parsePlayMessage({ type: 'tilawah:stop', infohash: hash('a') })).toBeNull();
    expect(parsePlayMessage({ type: 'tilawah:play', infohash: 'short' })).toBeNull();
    expect(parsePlayMessage({ type: 'tilawah:play', infohash: 'g'.repeat(40) })).toBeNull();
    expect(parsePlayMessage({ type: 'tilawah:play', infohash: 42 })).toBeNull();
  });
});

describe('playingNow', () => {
  test('protects exactly the reciter the play message named', () => {
    const guard = playingNow(hash('n'));
    expect(guard.size).toBe(1);
    expect(guard.has(hash('n'))).toBe(true);
  });

  test('the engine merely holding a torrent is never proof it is playing', () => {
    // The C1 lesson, pinned: a warm engine holds the whole roster, so a guard
    // grown from the engine snapshot protects everyone and the cap never trims.
    const guard = playingNow(hash('n'));
    expect(guard.has(hash('a'))).toBe(false);
    expect(guard.has(hash('b'))).toBe(false);
  });
});
