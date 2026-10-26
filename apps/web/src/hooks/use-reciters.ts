import { useEffect, useState } from 'react';

import { RECITERS } from '@/constants';
import { MagnetlinkSource, type Reciter } from '@/types';

/**
 * The reciter list, served by the admin catalogue.
 *
 * The catalogue is the source of truth for *what exists and where it announces*;
 * the static list remains the source of display metadata (Arabic name, source
 * badge, Itqan fallback playlist), matched by infohash. A row the catalogue adds
 * has no Arabic name yet, so its catalogue name is shown.
 *
 * If the request fails the static list is returned unchanged: a catalogue outage
 * must not turn the player into an empty page.
 */

interface CatalogueRow {
  name: string;
  riwaya: string;
  infohash: string;
  magnet: string;
  sizeBytes: number | null;
  fileCount: number;
}

const ADMIN_API =
  (import.meta as { env?: Record<string, string> }).env?.VITE_ADMIN_API_URL ||
  'https://admin-tilawa.quran.us.kg';

let pending: Promise<Reciter[]> | null = null;

function infohashOf(magnet: string): string | null {
  const match = magnet.match(/urn:btih:([0-9a-z]+)/i);
  return match ? match[1].toLowerCase() : null;
}

/** Stable id for a catalogue-only row, so a link to it survives a reload. */
function idFromHash(hash: string): number {
  let value = 0;
  for (const char of hash.slice(0, 8)) value = (value * 31 + char.charCodeAt(0)) % 1_000_000;
  return 1_000_000 + value;
}

async function fetchAndMerge(): Promise<Reciter[]> {
  try {
    const response = await fetch(`${ADMIN_API}/api/public/reciters`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return RECITERS;
    const body = (await response.json()) as { reciters?: CatalogueRow[] };
    if (!Array.isArray(body.reciters) || body.reciters.length === 0) return RECITERS;

    const known = new Map<string, Reciter>();
    for (const reciter of RECITERS) {
      const hash = infohashOf(reciter.magnet);
      if (hash) known.set(hash, reciter);
    }

    const merged: Reciter[] = [];
    for (const row of body.reciters) {
      const hash = row.infohash.toLowerCase();
      const existing = known.get(hash);
      if (existing) {
        merged.push({ ...existing, magnet: row.magnet });
        known.delete(hash);
      } else {
        merged.push({
          id: idFromHash(hash),
          name: row.name,
          magnet: row.magnet,
          source: MagnetlinkSource.MP3QURAN,
          complet: true,
        });
      }
    }
    return merged;
  } catch {
    return RECITERS;
  }
}

export function useReciters(): { reciters: Reciter[]; fromCatalogue: boolean } {
  const [reciters, setReciters] = useState<Reciter[]>(RECITERS);
  const [fromCatalogue, setFromCatalogue] = useState(false);

  useEffect(() => {
    let live = true;
    pending ??= fetchAndMerge();
    void pending.then((list) => {
      if (!live) return;
      setReciters(list);
      setFromCatalogue(list !== RECITERS);
    });
    return () => {
      live = false;
    };
  }, []);

  return { reciters, fromCatalogue };
}

export { infohashOf };
