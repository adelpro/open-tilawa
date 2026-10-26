import { atom } from 'jotai';

import type { TorrentInfo } from '@/types';

/**
 * Playback state lives here rather than inside the player component, because
 * the audio engine, the queue, the desk and the mobile mini-player are four
 * separate trees that must observe the same truth.
 *
 * Ownership rule (see the v2 design doc §7): the URL owns *which surah*; these
 * atoms own *where inside it*. Nothing here writes the URL.
 */

/** 0-based index into `torrentAtom.files`, which is sorted by surah id. */
export const currentIndexAtom = atom(0);
export const isPlayingAtom = atom(false);
export const positionAtom = atom(0);
export const durationAtom = atom(0);
export const bufferedAtom = atom(0);

export type RepeatMode = 'off' | 'one';
export const repeatAtom = atom<RepeatMode>('off');
export const shuffleAtom = atom(false);
/** Permutation of file indices, longest-first; empty means "mushaf order". */
export const shuffleOrderAtom = atom<number[]>([]);
export const rateAtom = atom(1);

/** Mobile only: is the queue sheet open over the Now Playing screen. */
export const queueOpenAtom = atom(false);

export const torrentAtom = atom<TorrentInfo | undefined>(undefined);
export const torrentErrorAtom = atom<string | undefined>(undefined);
/** Bumping this is the retry button; the torrent hook watches it. */
export const retrySignalAtom = atom(0);
