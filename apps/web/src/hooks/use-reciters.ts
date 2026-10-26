import { useEffect, useState } from 'react';

import { RECITERS } from '@/constants';
import type { Reciter } from '@/types';
import { mergeReciters, type CatalogueRow } from '@/utils/reciter-merge';

/**
 * The reciter list, served by the admin catalogue.
 *
 * The catalogue is the source of truth for *what exists and where it announces*;
 * the static list keeps the metadata only we have (source badge, Itqan fallback
 * playlist, stable ids); `constants/reciter-names` supplies the Arabic name, by
 * infohash, because the catalogue serves torrent folder names.
 *
 * If the request fails the static list is returned unchanged: a catalogue outage
 * must not turn the player into an empty page.
 */

const ADMIN_API =
  (import.meta as { env?: Record<string, string> }).env?.VITE_ADMIN_API_URL ||
  'https://admin-tilawa.quran.us.kg';

let pending: Promise<Reciter[]> | null = null;

async function fetchAndMerge(): Promise<Reciter[]> {
  try {
    const response = await fetch(`${ADMIN_API}/api/public/reciters`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return RECITERS;
    const body = (await response.json()) as { reciters?: CatalogueRow[] };
    if (!Array.isArray(body.reciters) || body.reciters.length === 0) return RECITERS;

    return mergeReciters(body.reciters as CatalogueRow[], RECITERS);
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
