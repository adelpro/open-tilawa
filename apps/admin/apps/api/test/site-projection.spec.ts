import { describe, expect, it } from '@jest/globals';
import {
  diffSite,
  projectSite,
  readSiteManifest,
  type SiteRelease,
} from '../src/reciters/site-projection';

/**
 * The console decides "the site needs a rebuild" by comparing two lists: the
 * catalogue now, and the roster the deployed build stamped into
 * `site-version.json`. These tests pin the two rules that make that honest — the
 * label is the one the page prints, and a malformed manifest is "unknown", never
 * "everything was deleted".
 */
describe('site projection', () => {
  const row = (over: Partial<Parameters<typeof projectSite>[0][number]> = {}) => ({
    slug: 'maher-al-muaiqly',
    name: 'Maher_Al-Muaiqly',
    nameAr: null,
    riwaya: 'Hafs',
    surahs: null,
    ...over,
  });

  it('names a release the way the page prints it', () => {
    expect(
      projectSite([
        row(),
        row({ slug: 'yassine-el-jazairi-warsh', nameAr: 'ياسين الجزائري', riwaya: 'Warsh' }),
      ]),
    ).toEqual([
      { slug: 'maher-al-muaiqly', name: 'Maher_Al-Muaiqly', riwaya: 'Hafs', surahs: '' },
      { slug: 'yassine-el-jazairi-warsh', name: 'ياسين الجزائري', riwaya: 'Warsh', surahs: '' },
    ]);
  });

  it('drops a row with no slug — it has no page to compare', () => {
    expect(projectSite([row({ slug: '  ' })])).toEqual([]);
  });

  it('trims the label and falls back to "unknown" for a missing riwaya', () => {
    expect(projectSite([row({ nameAr: '  ماهر  ', riwaya: '   ' })])).toEqual([
      { slug: 'maher-al-muaiqly', name: 'ماهر', riwaya: 'unknown', surahs: '' },
    ]);
  });

  it('normalizes the stored surah list into the page key', () => {
    expect(projectSite([row({ surahs: '[19,1,18]' })])[0].surahs).toBe('1,18,19');
    expect(projectSite([row({ surahs: 'not json' })])[0].surahs).toBe('');
  });
});

describe('site manifest', () => {
  const release = (over: Partial<SiteRelease> = {}): SiteRelease => ({
    slug: 'maher-al-muaiqly',
    name: 'ماهر المعيقلي',
    riwaya: 'Hafs',
    surahs: '',
    ...over,
  });

  it('reads a manifest the build wrote', () => {
    expect(
      readSiteManifest({
        builtAt: '2026-11-06T10:00:00.000Z',
        releases: [release()],
      }),
    ).toEqual({
      builtAt: '2026-11-06T10:00:00.000Z',
      releases: [release()],
    });
  });

  it('reads the surah list, and treats its absence as unknown', () => {
    expect(
      readSiteManifest({
        builtAt: null,
        releases: [{ slug: 'partial', name: 'Partial', riwaya: 'Warsh', surahs: '1,18' }],
      }),
    ).toEqual({
      builtAt: null,
      releases: [{ slug: 'partial', name: 'Partial', riwaya: 'Warsh', surahs: '1,18' }],
    });
    expect(
      readSiteManifest({ releases: [{ slug: 'old', name: 'Old', riwaya: 'Hafs' }] }),
    ).toEqual({
      builtAt: null,
      releases: [{ slug: 'old', name: 'Old', riwaya: 'Hafs', surahs: '' }],
    });
  });

  it('treats a missing or malformed manifest as unknown', () => {
    expect(readSiteManifest(null)).toBeNull();
    expect(readSiteManifest({})).toBeNull();
    expect(readSiteManifest({ releases: 'nope' })).toBeNull();
    expect(readSiteManifest({ releases: [{ slug: 1, name: 'x', riwaya: 'y' }] })).toBeNull();
  });
});

describe('site diff', () => {
  const release = (over: Partial<SiteRelease> = {}): SiteRelease => ({
    slug: 'maher-al-muaiqly',
    name: 'ماهر المعيقلي',
    riwaya: 'Hafs',
    surahs: '',
    ...over,
  });

  it('reports an identical roster as in sync', () => {
    expect(diffSite([release()], [release()])).toEqual({
      added: [],
      removed: [],
      renamed: [],
      changed: false,
    });
  });

  it('reports a newly published reciter, including the two that prompted this', () => {
    const ali = release({ slug: 'ali-jaber', name: 'علي جابر' });
    const abdelaziz = release({ slug: 'abdelaziz-sheim', name: 'عبدالعزيز سحيم' });
    const diff = diffSite([release(), ali, abdelaziz], [release()]);
    expect(diff.added.map((entry) => entry.slug)).toEqual(['ali-jaber', 'abdelaziz-sheim']);
    expect(diff.removed).toEqual([]);
    expect(diff.renamed).toEqual([]);
    expect(diff.changed).toBe(true);
  });

  it('reports an unpublish or delete as a page to remove', () => {
    const diff = diffSite([release()], [release(), release({ slug: 'ali-jaber' })]);
    expect(diff.removed.map((entry) => entry.slug)).toEqual(['ali-jaber']);
    expect(diff.added).toEqual([]);
    expect(diff.changed).toBe(true);
  });

  it('reports a rename as a page whose words changed', () => {
    const diff = diffSite(
      [release({ name: 'ماهر المعيقلي (مرتل)' })],
      [release({ name: 'ماهر المعيقلي' })],
    );
    expect(diff.renamed).toEqual([
      {
        slug: 'maher-al-muaiqly',
        from: release({ name: 'ماهر المعيقلي' }),
        to: release({ name: 'ماهر المعيقلي (مرتل)' }),
      },
    ]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toBe(true);
  });

  it('reports a riwaya correction as a rename', () => {
    const diff = diffSite([release({ riwaya: 'Warsh' })], [release({ riwaya: 'Hafs' })]);
    expect(diff.renamed).toHaveLength(1);
    expect(diff.changed).toBe(true);
  });

  it('reports a changed surah list as a content change', () => {
    const diff = diffSite([release({ surahs: '1,18' })], [release()]);
    expect(diff.renamed).toHaveLength(1);
    expect(diff.changed).toBe(true);
  });
});
