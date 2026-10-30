import { assignSlug, slugify } from './slug';

/**
 * The two fixtures that broke the naive rule: `reciter-names.ts` holds two rows named
 * `محمود خليل الحصري` and two named `محمد صديق المنشاوي`, so a slug derived from the
 * display name could not be unique on the day it was introduced.
 */
describe('slugify', () => {
  it('reads a torrent name as words a person can type', () => {
    expect(slugify('Maher_Al-Muaiqly_(Update2)_(MP3_Quran)')).toBe('maher-al-muaiqly');
    expect(slugify('Abdulbasit_Abdulsamad_Mojawwad')).toBe('abdulbasit-abdulsamad-mojawwad');
  });

  it('drops the words the folder carries for itself', () => {
    expect(slugify('Al-Husary - Complete Quran MP3')).toBe('al-husary');
  });

  it('never returns a leading or trailing dash', () => {
    for (const name of ['(Cairo)', 'a  b', '---', 'Quran (MP3)']) {
      expect(slugify(name)).not.toMatch(/(^-|-$)/);
    }
  });

  it('is bounded', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe('assignSlug', () => {
  const husaryHafs = '1a65ddf6472839c8ec02248650330cac38109670';
  const husaryWarsh = '87c83e0b4432d70565e2dbc4e20988285778e189';

  it('uses the bare slug when it is free', () => {
    expect(assignSlug('al-husary', 'hafs', husaryHafs, new Set())).toBe('al-husary');
  });

  it('separates two readings of one reciter by the riwaya', () => {
    const taken = new Set(['al-husary']);
    expect(assignSlug('al-husary', 'warsh', husaryWarsh, taken)).toBe('al-husary-warsh');
  });

  it('falls back to the infohash when the name and the reading are both taken', () => {
    const taken = new Set(['al-husary', 'al-husary-hafs']);
    expect(assignSlug('al-husary', 'hafs', husaryWarsh, taken)).toBe('al-husary-hafs-87c8');
  });

  it('is deterministic: the same rows in the same order always resolve the same way', () => {
    const rows = [
      { base: 'al-husary', riwaya: 'hafs', infohash: husaryHafs },
      { base: 'al-husary', riwaya: 'warsh', infohash: husaryWarsh },
    ];
    const run = () => {
      const taken = new Set<string>();
      return rows.map((row) => {
        const slug = assignSlug(row.base, row.riwaya, row.infohash, taken);
        taken.add(slug);
        return slug;
      });
    };
    expect(run()).toEqual(run());
    expect(new Set(run()).size).toBe(2);
  });

  it('still produces something when the name slugifies to nothing', () => {
    expect(assignSlug('', 'hafs', husaryHafs, new Set())).toBe('release-1a65ddf6');
  });
});
