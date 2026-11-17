/**
 * What the catalogue serves, and what changed since last time.
 *
 * The extension asks the same public endpoint the site's prerender asks
 * (`console.tilawah.cc/api/public/reciters`), and it must read it the same way:
 * a row is shown because a human published it, a demo or test row with no
 * magnet is not a reciter, and two rows naming one release are one release.
 *
 * `diffCatalogue` is the reason this module exists. The volunteer chose what to
 * hold; the catalogue changes on its own. Nothing here may add a reciter to the
 * held list — it reports, and the person decides.
 */

export type Reciter = {
  /** Catalogue id; the only ordering signal the public API gives ("newest" is highest). */
  id?: number;
  infohash: string;
  slug: string;
  name: string;
  nameAr: string;
  riwaya: string;
  sizeBytes: number | null;
  /** The surahs the release carries; `null` means unknown, which is the whole book. */
  surahs: number[] | null;
  /** What the swarm looks like right now; `null` when the catalogue did not say. */
  swarm: ReciterSwarm | null;
  complete: boolean;
};

export type ReciterSource = 'manual' | 'follow';

/**
 * What the swarm said about one release, as the catalogue reports it.
 *
 * `thin` is the only state that asks anything of the person; the rest are context.
 * `unknown` means the catalogue could not measure it (never sampled, or the last
 * sample is stale) and is never shown as "nobody seeds it".
 */
export type ReciterSwarm = {
  health: 'thin' | 'ok' | 'healthy' | 'unknown';
  seeders: number | null;
};

export type HeldReciter = Reciter & { addedAt: string; source: ReciterSource };

export const FULL_QURAN = 114;

const INFO_HASH = /^[0-9a-f]{40}$/i;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** `null` means "unknown, the whole book"; a list outside the mushaf is not a list. */
function manifestOf(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.filter((id): id is number => Number.isInteger(id) && (id as number) >= 1 && (id as number) <= FULL_QURAN);
  return list.length > 0 ? list : null;
}

const SWARM_STATES: readonly ReciterSwarm['health'][] = ['thin', 'ok', 'healthy', 'unknown'];

/**
 * The health block, read rather than trusted.
 *
 * It arrived after this extension's storage was already written, so an old row has
 * no block and a hand-edited one can hold anything. A missing or unreadable block
 * is `null` — "the catalogue did not say" — and no surface may read that as
 * "nobody seeds it".
 */
function parseSwarm(value: unknown): ReciterSwarm | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { health?: unknown; seeders?: unknown };
  const health = SWARM_STATES.includes(row.health as ReciterSwarm['health'])
    ? (row.health as ReciterSwarm['health'])
    : 'unknown';
  const seeders =
    typeof row.seeders === 'number' && Number.isFinite(row.seeders)
      ? Math.max(0, Math.trunc(row.seeders))
      : null;
  return { health, seeders };
}

/** Catalogue rows → the roster this extension can hold. */
export function toReciters(rows: unknown): Reciter[] {
  if (!Array.isArray(rows)) return [];

  const seen = new Set<string>();
  const list: Reciter[] = [];

  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;

    // A torrent is addressed by its hash; a row without a valid one cannot be
    // fetched, seeded or deduplicated.
    const infohash = text(row.infohash).toLowerCase();
    if (!INFO_HASH.test(infohash)) continue;

    // No magnet means nothing published, whatever the rest of the row says.
    if (!text(row.magnet)) continue;

    if (seen.has(infohash)) continue;
    seen.add(infohash);

    const nameAr = text(row.nameAr);
    const name = text(row.name);

    // The manifest is an index into the 114. An id outside the mushaf can never
    // name a file, and an empty list is "unknown", not "an empty book".
    const manifest = manifestOf(row.surahs) ?? [];

    list.push({
      id: typeof row.id === 'number' && Number.isFinite(row.id) ? row.id : undefined,
      infohash,
      slug: text(row.slug),
      name: name || nameAr || infohash.slice(0, 8),
      nameAr,
      riwaya: text(row.riwaya) || 'unknown',
      sizeBytes:
        typeof row.sizeBytes === 'number' && Number.isFinite(row.sizeBytes) ? row.sizeBytes : null,
      surahs: manifest.length > 0 ? manifest : null,
      swarm: parseSwarm(row.swarm),
      complete: (typeof row.fileCount === 'number' ? row.fileCount : 0) >= FULL_QURAN,
    });
  }

  // Arabic collation so the picker reads in an order a reader expects.
  return list.sort((a, b) => (a.nameAr || a.name).localeCompare(b.nameAr || b.name, 'ar'));
}

/**
 * The stored roster, read back in the order it was written.
 *
 * Order is information here — the follow list's recency is the held list's
 * order — so this deliberately does not reuse `toReciters`, whose sort is for
 * the picker. A row without a valid hash is dropped, not repaired; a row
 * without a source is a pre-modes row and is a manual choice.
 */
/**
 * The reciter's page on tilawah.cc, written the way the site writes its own
 * paths: the raw slug, no encoding (`apps/web/src/routes.ts` `toPath`), and the
 * production origin — staging is for proving the follow flow, not a place to
 * send anyone. A release without a slug has no page; sending a person to a
 * 404 would be worse than a plain name.
 */
export function reciterUrl(slug: string): string | null {
  const path = slug.trim();
  return path ? `https://tilawah.cc/reciters/${path}` : null;
}

export function parseHeld(raw: unknown): HeldReciter[] {
  if (!Array.isArray(raw)) return [];
  const out: HeldReciter[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const infohash = text(row.infohash).toLowerCase();
    if (!INFO_HASH.test(infohash)) continue;
    const nameAr = text(row.nameAr);
    const name = text(row.name);
    const addedAt =
      typeof row.addedAt === 'string' && !Number.isNaN(Date.parse(row.addedAt))
        ? row.addedAt
        : new Date().toISOString();
    out.push({
      id: typeof row.id === 'number' && Number.isFinite(row.id) ? row.id : undefined,
      infohash,
      slug: text(row.slug),
      name: name || nameAr || infohash.slice(0, 8),
      nameAr,
      riwaya: text(row.riwaya) || 'unknown',
      sizeBytes:
        typeof row.sizeBytes === 'number' && Number.isFinite(row.sizeBytes) ? row.sizeBytes : null,
      surahs: manifestOf(row.surahs),
      // A measurement, not a choice: the stored row is what the person decided to
      // keep, and a health number frozen at save time would be a lie on the shelf.
      swarm: null,
      complete: row.complete === true,
      addedAt,
      source: row.source === 'follow' ? 'follow' : 'manual',
    });
  }
  return out;
}

/**
 * What to tell the person about the roster.
 *
 * A new hash under a known slug is one reciter re-imported, not two reciters; a
 * held hash the catalogue stopped listing is reported and kept, never deleted.
 */
export function diffCatalogue(
  held: HeldReciter[],
  rows: Reciter[],
): { added: Reciter[]; replaced: { from: HeldReciter; to: Reciter }[]; unpublished: HeldReciter[] } {
  const heldByHash = new Map(held.map((reciter) => [reciter.infohash, reciter]));
  const heldBySlug = new Map(
    held.filter((reciter) => reciter.slug).map((reciter) => [reciter.slug, reciter]),
  );
  const catalogueHashes = new Set(rows.map((row) => row.infohash));

  const added: Reciter[] = [];
  const replaced: { from: HeldReciter; to: Reciter }[] = [];

  for (const row of rows) {
    if (heldByHash.has(row.infohash)) continue;
    const prior = row.slug ? heldBySlug.get(row.slug) : undefined;
    if (prior) replaced.push({ from: prior, to: row });
    else added.push(row);
  }

  return {
    added,
    replaced,
    // A replaced reciter's old hash is, by definition, no longer listed. It is
    // not "unpublished": it is the same reciter, reported once as a replacement.
    unpublished: held.filter(
      (reciter) =>
        !catalogueHashes.has(reciter.infohash) &&
        !replaced.some((entry) => entry.from.infohash === reciter.infohash),
    ),
  };
}
