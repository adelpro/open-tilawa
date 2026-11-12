import type { Reciter } from '@/types';
import { cleanTorrentName } from '@/utils/reciter-name';
import { sortByArabicName } from '@/utils/reciter-order';

/**
 * What the catalogue serves. The player adds nothing of its own: the roster is
 * this list, in reading order, and a row is shown because a human published it.
 */
export type CatalogueRow = {
  id: number;
  name: string;
  nameAr: string | null;
  riwaya: string;
  infohash: string;
  magnet: string;
  fileCount: number | null;
  sizeBytes?: number | null;
  slug?: string | null;
  /** The surah ids the release carries; absent on an older catalogue. */
  surahs?: number[] | null;
};

/** 114 surahs is the whole book; fewer means a partial release. */
const FULL_QURAN = 114;

/**
 * Catalogue rows → the player's list.
 *
 * Three rows are dropped rather than rendered: no numeric id (the catalogue is
 * older than this client, and the id keys saved positions), no magnet (nothing
 * to play), and a repeated infohash (two rows, one release).
 */
export function toReciters(rows: CatalogueRow[]): Reciter[] {
  const seen = new Set<string>();
  const list: Reciter[] = [];

  for (const row of rows) {
    if (!row || typeof row.id !== 'number' || !Number.isFinite(row.id)) continue;
    const magnet = (row.magnet ?? '').trim();
    if (!magnet) continue;

    const hash = (row.infohash ?? '').toLowerCase();
    if (hash) {
      if (seen.has(hash)) continue;
      seen.add(hash);
    }

    const nameAr = row.nameAr?.trim() ?? '';
    const nameEn = cleanTorrentName(row.name ?? '') || nameAr;
    // A manifest is an index into the 114, not free data: an id outside the mushaf
    // can never name a file, and an empty list is "unknown", not an empty book.
    const manifest = Array.isArray(row.surahs)
      ? row.surahs.filter((id) => Number.isInteger(id) && id >= 1 && id <= FULL_QURAN)
      : [];

    list.push({
      id: row.id,
      name: nameAr || nameEn,
      nameEn,
      magnet,
      riwaya: row.riwaya?.trim() || 'unknown',
      complet: (row.fileCount ?? 0) >= FULL_QURAN,
      surahs: manifest.length > 0 ? manifest : null,
      sizeBytes:
        typeof row.sizeBytes === 'number' && Number.isFinite(row.sizeBytes) ? row.sizeBytes : null,
      slug: (row.slug ?? '').trim(),
    });
  }

  return sortByArabicName(list, (reciter) => reciter.name);
}
