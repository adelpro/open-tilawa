import type { Reciter } from '@/types';
import { cleanTorrentName } from '@/utils/reciter-name';

/**
 * What the catalogue serves. The player adds nothing of its own: the roster is
 * this list, in this order, and a row is shown because a human published it.
 */
export type CatalogueRow = {
  id: number;
  name: string;
  nameAr: string | null;
  riwaya: string;
  infohash: string;
  magnet: string;
  fileCount: number | null;
  slug?: string | null;
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

    list.push({
      id: row.id,
      name: row.nameAr?.trim() || cleanTorrentName(row.name ?? ''),
      magnet,
      riwaya: row.riwaya?.trim() || 'unknown',
      complet: (row.fileCount ?? 0) >= FULL_QURAN,
      slug: (row.slug ?? '').trim(),
    });
  }

  return list;
}
