import { atom } from 'jotai';

import type { TorrentInfo } from '@/types';
import type { Visualiser } from '@/utils/visualiser-models';

/**
 * Playback state. There is one screen, so this is the whole model:
 *
 * - `currentSurahIdAtom` is *what* is selected (1–114). It survives before the
 *   torrent's file list exists, which is why it is not an index.
 * - The engine finds the track for that surah inside `torrentAtom.files`.
 * - The rest is where inside the surah we are.
 */

export const currentSurahIdAtom = atom(1);
export const isPlayingAtom = atom(false);
export const positionAtom = atom(0);
export const durationAtom = atom(0);
/** Playback speed. A listener preference, so it outlives the surah. */
export const rateAtom = atom(1);
/** In-session only: a muted start would look like a broken player tomorrow. */
export const mutedAtom = atom(false);
/** Which shape the spectrum takes; a taste, so it is remembered. */
export const visualiserAtom = atom<Visualiser>('bars');

export const torrentAtom = atom<TorrentInfo | undefined>(undefined);
export const torrentErrorAtom = atom<string | undefined>(undefined);
/** Bumping this is the retry button; the torrent hook watches it. */
export const retrySignalAtom = atom(0);
