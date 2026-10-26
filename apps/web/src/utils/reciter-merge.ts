import { RECITER_NAMES_AR } from '@/constants/reciter-names';
import { MagnetlinkSource, type Reciter } from '@/types';
import { parseMagnet } from '@/utils/magnet';

export type CatalogueRow = {
  name: string;
  infohash: string;
  magnet: string;
  riwaya?: string;
  /** The catalogue may start sending an explicit Arabic name; prefer it. */
  nameAr?: string;
};

/** `Maher_Al-Muaiqly_(Update2)_(MP3_Quran)` → `Maher Al Muaiqly`. */
export function cleanTorrentName(raw: string): string {
  return raw
    .replace(/^the holy quran mp3 recited by\s+/i, '')
    .replace(/\((?:mp3[_\s]?quran|update\s*\d*)\)/gi, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Stable id for a catalogue-only row, so a choice survives a reload. */
export function idFromHash(hash: string): number {
  let value = 0;
  for (const char of hash.slice(0, 8)) value = (value * 31 + char.charCodeAt(0)) % 1_000_000;
  return 1_000_000 + value;
}

export function infohashOf(magnet: string): string | null {
  return parseMagnet(magnet)?.infoHash?.toLowerCase() ?? null;
}

/**
 * The catalogue decides *what exists*; the static list keeps the metadata that
 * only we have (Itqan fallback playlists, source badge, stable ids); this table
 * decides the Arabic name.
 *
 * Two things the old merge got wrong and this one fixes:
 * - it returned only catalogue rows, so a reciter that exists as HTTP links but
 *   has no torrent (بدر التركي, ماجد الزميل) disappeared from the site;
 * - it trusted the static name over the torrent's own `dn`, so a mislabelled
 *   hash showed one reciter's name over another reciter's audio.
 */
export function mergeReciters(
  rows: CatalogueRow[],
  statics: Reciter[],
  names: Record<string, string> = RECITER_NAMES_AR,
): Reciter[] {
  const byHash = new Map<string, Reciter>();
  for (const reciter of statics) {
    const hash = infohashOf(reciter.magnet);
    if (hash) byHash.set(hash, reciter);
  }

  const seen = new Set<string>();
  const merged: Reciter[] = [];

  for (const row of rows) {
    const hash = row.infohash.toLowerCase();
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);

    const known = byHash.get(hash);
    const name = row.nameAr ?? names[hash] ?? cleanTorrentName(row.name);

    merged.push(
      known
        ? { ...known, name, magnet: row.magnet }
        : {
            id: idFromHash(hash),
            name,
            magnet: row.magnet,
            source: MagnetlinkSource.MP3QURAN,
            complet: true,
          },
    );
  }

  // Reciters that only exist as direct links have nothing to announce, so the
  // catalogue cannot know them; they belong at the end of the list, not in the bin.
  for (const reciter of statics) {
    if (infohashOf(reciter.magnet)) continue;
    merged.push(reciter);
  }

  return merged;
}
