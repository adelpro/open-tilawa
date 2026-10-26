import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { selectedReciterAtom } from '@/jotai/atom';
import {
  currentIndexAtom,
  isPlayingAtom,
  shuffleAtom,
  shuffleOrderAtom,
  torrentAtom,
} from '@/jotai/player';
import type { TrackType } from '@/types';
import { nextIndex, playOrder, previousIndex } from '@/utils/queue';

/** The surah id a file plays, falling back to its position for odd filenames. */
export function surahIdOf(track: TrackType | undefined, index: number): number {
  if (!track) return index + 1;
  return track.surahId > 0 ? track.surahId : index + 1;
}

/**
 * One place that turns "play index N" into a URL change. Every transport
 * button, queue row and mini-player in the app goes through here, so no
 * component is allowed to invent its own way of changing the track.
 */
export function usePlayerNav() {
  const navigate = useNavigate();
  const reciter = useAtomValue(selectedReciterAtom);
  const torrent = useAtomValue(torrentAtom);
  const index = useAtomValue(currentIndexAtom);
  const shuffle = useAtomValue(shuffleAtom);
  const order = useAtomValue(shuffleOrderAtom);
  const setIsPlaying = useSetAtom(isPlayingAtom);

  const files = torrent?.files ?? [];
  const walk = playOrder(files.length, shuffle, order);

  const playIndex = useCallback(
    (nextAt: number) => {
      const track = files[nextAt];
      if (!reciter || !track) return;
      navigate(`/reciter/${reciter.id}/${surahIdOf(track, nextAt)}`);
      setIsPlaying(true);
    },
    [files, navigate, reciter, setIsPlaying],
  );

  const playSurahId = useCallback(
    (surahId: number) => {
      const at = files.findIndex((track, i) => surahIdOf(track, i) === surahId);
      if (at >= 0) playIndex(at);
    },
    [files, playIndex],
  );

  return {
    files,
    walk,
    playIndex,
    playSurahId,
    next: () => playIndex(nextIndex(index, walk)),
    previous: () => playIndex(previousIndex(index, walk)),
  };
}
