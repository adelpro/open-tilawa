import { atom } from 'jotai';

import type { TorrentInfo } from '@/types';
import { DEFAULT_VOLUME, readVolume, toggleVolume } from '@/utils/volume';
import { DEFAULT_VISUALISER, type Visualiser } from '@/utils/visualiser-models';

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

/**
 * Output level, 0–1. 0 **is** mute: the long press and the gauge's floor agree
 * because they write the same number. The initial read happens once, at module
 * load, and is guarded for the prerender (no window).
 */
const initialVolume = readVolume();
export const volumeAtom = atom(initialVolume);
/** What a mute restores. In-session: a silent start still looks broken. */
export const lastVolumeAtom = atom(initialVolume > 0 ? initialVolume : DEFAULT_VOLUME);
/** Mute keeps the level it silenced; the second press restores it. */
export const toggleMuteAtom = atom(null, (get, set) => {
  const next = toggleVolume(get(volumeAtom), get(lastVolumeAtom));
  set(lastVolumeAtom, next.lastVolume);
  set(volumeAtom, next.volume);
});
/** Which shape the block takes; a taste, so it is remembered. */
/**
 * The instrument is the player's face: it shows the reciter's melody and the
 * madds. The three spectrum shapes stay in settings for anyone who wants them.
 */
export const visualiserAtom = atom<Visualiser>(DEFAULT_VISUALISER);

export const torrentAtom = atom<TorrentInfo | undefined>(undefined);
export const torrentErrorAtom = atom<string | undefined>(undefined);
/** Bumping this is the retry button; the torrent hook watches it. */
export const retrySignalAtom = atom(0);
