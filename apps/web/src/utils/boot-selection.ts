import type { Parsed } from '@/routes';
import type { Reciter } from '@/types';

/**
 * What the player selects when the app opens, in one place.
 *
 * Two things want to answer that question — the address, and where the listener
 * stopped last time — and for a while both did: a `/listen/<slug>/<n>` link set the
 * reciter and the surah, then this restore step overwrote them with the stored pair,
 * so every link to a surah landed on the first one. The rule that settles it is the
 * one a listener would state: **if the address names what to play, nothing else does.**
 *
 * Returns `null` when the boot step should keep its hands off.
 */
export type BootSelection = { reciter: Reciter; surahId: number };

export function bootSelection(input: {
  route: Parsed;
  reciters: readonly Reciter[];
  storedReciterId?: number;
  storedSurahId?: number;
  /** The per-reciter playhead, which outranks the shared "last surah". */
  savedPositionFor: (reciterId: number) => { surahId: number } | undefined;
}): BootSelection | null {
  if (input.route.name === 'listen') return null;
  if (input.reciters.length === 0) return null;

  const reciter =
    input.reciters.find((candidate) => candidate.id === input.storedReciterId) ?? input.reciters[0];
  const surahId =
    input.savedPositionFor(reciter.id)?.surahId ??
    // The last surah was picked under one reciter's release, so it means nothing
    // under another one — falling back to it would open a surah they never chose.
    (input.storedReciterId === reciter.id ? input.storedSurahId : undefined) ??
    1;

  return { reciter, surahId };
}
