/**
 * What the deployed build contains, written next to the pages it describes.
 *
 * The console cannot know whether the public site is stale from its own database:
 * a manual `docker compose up` is invisible to it. So the build stamps the roster
 * it prerendered into `site-version.json`, and the console diffs that file against
 * the live catalogue. One file, no duplicated hashing, and a manual deploy clears
 * the notice as surely as one started from the console.
 *
 * The shape is the admin's contract (`site-projection.ts`): slug + the name the
 * page prints + the stored riwaya. Keep the two in step.
 */

export interface SiteManifestRelease {
  slug: string;
  /** `nameAr` when the row has one, else the torrent name — the label on the page. */
  name: string;
  riwaya: string;
}

export interface SiteManifest {
  builtAt: string;
  releases: SiteManifestRelease[];
}

export interface CatalogueRow {
  slug?: string | null;
  name?: string | null;
  nameAr?: string | null;
  riwaya?: string | null;
}

/**
 * The roster as the prerender printed it.
 *
 * Sorted by slug so the file is stable across builds: the diff is a set
 * comparison, and a stable order makes a hand-read of the file mean something.
 * A row without a slug has no page, so it cannot drift.
 */
export function siteManifest(
  rows: readonly CatalogueRow[],
  builtAt: string = new Date().toISOString(),
): SiteManifest {
  const releases = rows
    .map((row) => ({
      slug: (row.slug ?? '').trim(),
      name: (row.nameAr?.trim() || row.name?.trim() || '').trim(),
      riwaya: (row.riwaya ?? '').trim() || 'unknown',
    }))
    .filter((release) => release.slug !== '')
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return { builtAt, releases };
}
