import { describe, expect, test } from 'vitest';

import { toReciters, type HeldReciter } from '../src/lib/catalogue';
import { planSync } from '../src/lib/sync';

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Maher_Al-Muaiqly',
  nameAr: 'ماهر المعيقلي',
  riwaya: 'Hafs',
  infohash: 'a'.repeat(40),
  magnet: 'magnet:?xt=urn:btih:aaaa',
  fileCount: 114,
  sizeBytes: 1_300_000_000,
  slug: 'maher-al-muaiqly',
  surahs: null,
  ...over,
});

const held = (over: Record<string, unknown> = {}): HeldReciter => ({
  ...toReciters([row(over)])[0]!,
  addedAt: '2026-11-15T00:00:00Z',
  source: 'manual',
});

describe('planSync', () => {
  test('a new reciter is a notice, never an added row', () => {
    const plan = planSync([], toReciters([row()]));

    expect(plan.hold).toEqual([]);
    expect(plan.notices).toHaveLength(1);
    expect(plan.notices[0]).toMatchObject({ kind: 'added', infohash: 'a'.repeat(40) });
    expect(plan.notices[0]!.name).toBe('ماهر المعيقلي');
  });

  test('an unpublished held reciter is reported but kept', () => {
    const current = held({ infohash: 'b'.repeat(40) });
    const plan = planSync([current], []);

    expect(plan.hold).toHaveLength(1);
    expect(plan.hold[0]!.infohash).toBe('b'.repeat(40));
    expect(plan.notices[0]).toMatchObject({ kind: 'unpublished' });
    expect(plan.notices[0]!.name).toBe('ماهر المعيقلي');
  });

  test('a re-imported reciter is a replacement notice, not a new one', () => {
    const current = held({ infohash: 'c'.repeat(40), slug: 'same' });
    const plan = planSync([current], toReciters([row({ infohash: 'd'.repeat(40), slug: 'same' })]));

    expect(plan.notices).toHaveLength(1);
    expect(plan.notices[0]).toMatchObject({ kind: 'replaced' });
    expect(plan.notices[0]!.name).toBe('ماهر المعيقلي');
  });

  test('an unchanged catalogue says nothing and keeps everything', () => {
    const current = held();
    const plan = planSync([current], toReciters([row()]));

    expect(plan.notices).toEqual([]);
    expect(plan.hold).toHaveLength(1);
  });
});
