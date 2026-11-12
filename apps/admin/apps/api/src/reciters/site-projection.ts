/**
 * What "the public site is up to date" means, as data.
 *
 * The console cannot see a deploy it did not start: a `docker compose up` on the
 * host leaves no row in SQLite. So the build stamps the roster it prerendered into
 * `/site-version.json`, and the two lists are compared here. This module is pure
 * on purpose — the diff is the part worth asserting, and it must not depend on the
 * network, the clock, or the shape of a request.
 *
 * The label rule is the page's rule: `nameAr` when the row has one, else the
 * torrent name. A riwaya correction is a content change even when the slug is
 * unchanged, so it is reported as a rename of the page's words.
 */

export interface SiteRelease {
  slug: string;
  name: string;
  riwaya: string;
  /** Comma-joined surah ids the reciter page listed; '' when unknown. */
  surahs: string;
}

export interface SiteManifest {
  builtAt: string | null;
  releases: SiteRelease[];
}

export interface SiteRow {
  slug: string | null;
  name: string;
  nameAr: string | null;
  riwaya: string;
  /** The `reciters.surahs` column: JSON text, or null when unknown. */
  surahs: string | null;
}

/**
 * The same key the build writes: ids in mushaf order, no duplicates, '' when the
 * column is absent or unreadable. The two sides must agree exactly, because this
 * is the field that notices a re-import that added or removed surahs.
 */
function surahsKey(value: string | null): string {
  if (!value) return '';
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return '';
    return [...new Set(parsed)]
      .filter((id): id is number => Number.isInteger(id) && (id as number) >= 1 && (id as number) <= 114)
      .sort((a, b) => a - b)
      .join(',');
  } catch {
    return '';
  }
}

export interface SiteDiff {
  added: SiteRelease[];
  removed: SiteRelease[];
  renamed: { slug: string; from: SiteRelease; to: SiteRelease }[];
  changed: boolean;
}

/**
 * The catalogue rows the public endpoint serves, in the shape the build writes.
 *
 * A row without a slug has no page and therefore cannot drift; drafts never reach
 * here because the caller filters on the public endpoint's own conditions.
 */
export function projectSite(rows: readonly SiteRow[]): SiteRelease[] {
  return rows
    .map((row) => ({
      slug: (row.slug ?? '').trim(),
      name: (row.nameAr?.trim() || row.name?.trim() || '').trim(),
      riwaya: (row.riwaya ?? '').trim() || 'unknown',
      surahs: surahsKey(row.surahs),
    }))
    .filter((release) => release.slug !== '')
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Parse the deployed manifest.
 *
 * A malformed file is `null`, not an empty list: the caller must say "cannot
 * verify", never "every reciter was removed" — the second answer would offer a
 * rebuild for a site that is already correct, and would hide a real parse bug.
 */
export function readSiteManifest(value: unknown): SiteManifest | null {
  if (!value || typeof value !== 'object') return null;
  const releases = (value as { releases?: unknown }).releases;
  if (!Array.isArray(releases)) return null;

  const parsed: SiteRelease[] = [];
  for (const entry of releases) {
    if (!entry || typeof entry !== 'object') return null;
    const { slug, name, riwaya, surahs } = entry as Record<string, unknown>;
    if (typeof slug !== 'string' || typeof name !== 'string' || typeof riwaya !== 'string') {
      return null;
    }
    if (!slug.trim()) continue;
    parsed.push({
      slug: slug.trim(),
      name: name.trim(),
      riwaya: riwaya.trim() || 'unknown',
      // A file written before this field existed is "unknown", not an empty book.
      surahs: typeof surahs === 'string' ? surahs.trim() : '',
    });
  }

  const builtAt = (value as { builtAt?: unknown }).builtAt;
  return { builtAt: typeof builtAt === 'string' ? builtAt : null, releases: parsed };
}

export function diffSite(
  current: readonly SiteRelease[],
  deployed: readonly SiteRelease[],
): SiteDiff {
  const currentBySlug = new Map(current.map((release) => [release.slug, release]));
  const deployedBySlug = new Map(deployed.map((release) => [release.slug, release]));

  const added = current.filter((release) => !deployedBySlug.has(release.slug));
  const removed = deployed.filter((release) => !currentBySlug.has(release.slug));
  const renamed = current.flatMap((release) => {
    const before = deployedBySlug.get(release.slug);
    if (
      !before ||
      (before.name === release.name &&
        before.riwaya === release.riwaya &&
        before.surahs === release.surahs)
    ) {
      return [];
    }
    return [{ slug: release.slug, from: before, to: release }];
  });

  return {
    added,
    removed,
    renamed,
    changed: added.length > 0 || removed.length > 0 || renamed.length > 0,
  };
}
