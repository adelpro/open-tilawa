import { describe, expect, test } from 'vitest';

import { diffCatalogue, parseHeld, reciterUrl, toReciters, type HeldReciter } from '../src/lib/catalogue';

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Reciter_Name',
  nameAr: 'قارئ',
  riwaya: 'Hafs',
  infohash: 'a'.repeat(40),
  magnet: 'magnet:?xt=urn:btih:aaaa',
  fileCount: 114,
  sizeBytes: 1_000,
  slug: 'reciter',
  surahs: null,
  ...over,
});

const held = (over: Record<string, unknown> = {}): HeldReciter => ({
  ...toReciters([row(over)])[0]!,
  addedAt: '2026-11-15T00:00:00Z',
  source: 'manual',
});

describe('toReciters', () => {
  test('a null surahs manifest means the whole book, not zero', () => {
    const [reciter] = toReciters([row({ surahs: null, fileCount: 114 })]);

    expect(reciter!.surahs).toBeNull();
    expect(reciter!.complete).toBe(true);
  });

  test('a reciter that disappears and returns is never duplicated', () => {
    const once = toReciters([row({ infohash: 'b'.repeat(40), surahs: [1, 2], fileCount: 16 })]);

    expect(toReciters([row({ infohash: 'b'.repeat(40), surahs: [1, 2], fileCount: 16 }), row({ infohash: 'b'.repeat(40) })])).toHaveLength(1);
    expect(diffCatalogue([{ ...once[0]!, addedAt: '2026-11-15T00:00:00Z', source: 'manual' }], once)).toEqual({
      added: [],
      replaced: [],
      unpublished: [],
    });
  });

  test('rows without an infohash or a magnet are dropped', () => {
    expect(toReciters([row({ infohash: '' }), row({ infohash: 'c'.repeat(40), magnet: '' })])).toHaveLength(0);
  });

  test('surahs outside the mushaf are filtered, and an empty list is unknown', () => {
    const [reciter] = toReciters([row({ surahs: [1, 115, 0, 2.5, 3] })]);

    expect(reciter!.surahs).toEqual([1, 3]);
    expect(toReciters([row({ surahs: [] })])[0]!.surahs).toBeNull();
  });

  test('the swarm block is read, and its unknowns stay unknown', () => {
    const [thin] = toReciters([row({ swarm: { health: 'thin', seeders: 0 } })]);
    expect(thin!.swarm).toEqual({ health: 'thin', seeders: 0 });

    // A catalogue that does not answer, a health word this build does not know,
    // and a negative count all land on something a surface can render.
    expect(toReciters([row()])[0]!.swarm).toBeNull();
    expect(toReciters([row({ swarm: { health: 'degraded', seeders: 2 } })])[0]!.swarm).toEqual({
      health: 'unknown',
      seeders: 2,
    });
    expect(toReciters([row({ swarm: { health: 'ok', seeders: -4 } })])[0]!.swarm).toEqual({
      health: 'ok',
      seeders: 0,
    });
  });
});

describe('diffCatalogue', () => {
  test('a new infohash under the same slug is a replacement, not an addition', () => {
    const current = held({ slug: 'same', infohash: 'd'.repeat(40) });
    const next = toReciters([row({ slug: 'same', infohash: 'e'.repeat(40) })]);

    const result = diffCatalogue([current], next);

    expect(result.added).toHaveLength(0);
    expect(result.replaced).toHaveLength(1);
    expect(result.replaced[0]!.from.infohash).toBe('d'.repeat(40));
    expect(result.replaced[0]!.to.infohash).toBe('e'.repeat(40));
  });

  test('a held reciter missing from the catalogue is unpublished, not added', () => {
    const current = held({ infohash: 'f'.repeat(40) });

    expect(diffCatalogue([current], [])).toEqual({ added: [], replaced: [], unpublished: [current] });
  });

  test('a genuinely new reciter is added and nothing else moves', () => {
    const current = held({ infohash: '1'.repeat(40), slug: 'one' });
    const next = toReciters([
      row({ infohash: '1'.repeat(40), slug: 'one' }),
      row({ infohash: '2'.repeat(40), slug: 'two' }),
    ]);

    const result = diffCatalogue([current], next);

    expect(result.added.map((r) => r.slug)).toEqual(['two']);
    expect(result.replaced).toHaveLength(0);
    expect(result.unpublished).toHaveLength(0);
  });
});

describe('reciterUrl', () => {
  test('is the canonical page on tilawah.cc, exactly as the site writes it', () => {
    expect(reciterUrl('maher-al-muaiqly')).toBe('https://tilawah.cc/reciters/maher-al-muaiqly');
    expect(reciterUrl('  spaced  ')).toBe('https://tilawah.cc/reciters/spaced');
  });

  test('a slug-less release has no page to send anyone to', () => {
    expect(reciterUrl('')).toBeNull();
    expect(reciterUrl('   ')).toBeNull();
  });
});

describe('parseHeld', () => {
  test('an empty or non-list answer is an empty roster', () => {
    expect(parseHeld([])).toEqual([]);
    expect(parseHeld(null)).toEqual([]);
    expect(parseHeld('held')).toEqual([]);
  });

  test('a stored row without a source migrates to manual', () => {
    const migrated = parseHeld([held()]);
    expect(migrated).toHaveLength(1);
    expect(migrated[0]?.source).toBe('manual');
    expect(migrated[0]?.addedAt).toBe('2026-11-15T00:00:00Z');
  });

  test('a follow-source row keeps its source and its stamp', () => {
    const row = { ...held(), source: 'follow' };
    expect(parseHeld([row])[0]?.source).toBe('follow');
  });

  test('a row without a valid infohash is dropped, not repaired', () => {
    expect(parseHeld([{ ...held(), infohash: 'short' }])).toEqual([]);
  });

  test('a row without addedAt gains the current time', () => {
    const { addedAt, ...rest } = held();
    const parsed = parseHeld([rest])[0];
    expect(parsed?.addedAt).toBeTruthy();
    expect(Number.isNaN(Date.parse(parsed!.addedAt))).toBe(false);
  });

  test('a stored row carries no swarm sample', () => {
    // A health number frozen at save time would be yesterday's answer on the shelf.
    const parsed = parseHeld([{ ...held(), swarm: { health: 'thin', seeders: 0 } }])[0];
    expect(parsed?.swarm).toBeNull();
  });
});
