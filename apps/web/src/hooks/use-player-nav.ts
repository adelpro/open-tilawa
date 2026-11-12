import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useMemo } from 'react';

import { getPosition, setLastSurah } from '@/hooks/use-persistence';
import { selectedReciterAtom } from '@/jotai/atom';
import {
  currentSurahIdAtom,
  durationAtom,
  isPlayingAtom,
  playbackModeAtom,
  positionAtom,
  shuffleOrderAtom,
  torrentAtom,
} from '@/jotai/player';
import { surahIdOf } from '@/utils/surah-id';
import { nextInQueue, previousInQueue, shuffledOrder } from '@/utils/playback';
import {
  nextSurahInRelease,
  previousSurahInRelease,
  surahIdsForRelease,
} from '@/utils/release-surahs';
import { audioRef } from '@/utils/audio-ref';

export const FIRST_SURAH = 1;
export const LAST_SURAH = 114;

/**
 * The only path from "play this surah" to a state change. Transport buttons,
 * sheet rows and the lock-screen handlers all come through here, so nothing can
 * invent its own idea of what "next" means.
 */
export function usePlayerNav() {
  const reciter = useAtomValue(selectedReciterAtom);
  const torrent = useAtomValue(torrentAtom);
  const [surahId, setSurahId] = useAtom(currentSurahIdAtom);
  const setPositionAtom = useSetAtom(positionAtom);
  const setIsPlaying = useSetAtom(isPlayingAtom);
  const duration = useAtomValue(durationAtom);
  const playbackMode = useAtomValue(playbackModeAtom);
  const [shuffleOrder, setShuffleOrder] = useAtom(shuffleOrderAtom);

  const files = torrent?.files ?? [];
  const track = useMemo(
    () => files.find((file, index) => surahIdOf(file, index) === surahId),
    [files, surahId],
  );

  /** Select a surah and its stored offset. Selecting never starts playback. */
  const selectSurah = useCallback(
    (target: number, forReciterId?: number) => {
      if (!Number.isInteger(target) || target < FIRST_SURAH || target > LAST_SURAH) return false;
      const stored = getPosition(forReciterId ?? reciter?.id);
      setPositionAtom(stored && stored.surahId === target ? stored.position : 0);
      setSurahId(target);
      setLastSurah(target);
      return true;
    },
    [reciter?.id, setPositionAtom, setSurahId],
  );

  const playSurah = useCallback(
    (target: number) => {
      if (selectSurah(target)) setIsPlaying(true);
    },
    [selectSurah, setIsPlaying],
  );

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(seconds)) return;
      audio.currentTime = seconds;
      setPositionAtom(seconds);
    },
    [setPositionAtom],
  );

  /**
   * The queue shuffle walks. Built once per reciter and kept until the mode is
   * re-selected (the write atom clears it); rebuilt here because a reload starts
   * with a stored mode and no queue.
   */
  const ensureShuffleOrder = useCallback((): number[] => {
    const reciterId = reciter?.id ?? null;
    if (shuffleOrder && shuffleOrder.reciterId === reciterId && shuffleOrder.ids.length > 0) {
      return shuffleOrder.ids;
    }
    const ids = shuffledOrder(surahIdsForRelease(reciter?.surahs));
    setShuffleOrder({ reciterId, ids });
    return ids;
  }, [reciter?.id, reciter?.surahs, setShuffleOrder, shuffleOrder]);

  const next = useCallback(() => {
    const target =
      playbackMode === 'shuffle'
        ? nextInQueue(surahId, ensureShuffleOrder())
        : nextSurahInRelease(surahId, reciter?.surahs);
    if (target !== null) playSurah(target);
  }, [ensureShuffleOrder, playbackMode, playSurah, reciter?.surahs, surahId]);
  const previous = useCallback(() => {
    const target =
      playbackMode === 'shuffle'
        ? previousInQueue(surahId, ensureShuffleOrder())
        : previousSurahInRelease(surahId, reciter?.surahs);
    if (target !== null) playSurah(target);
  }, [ensureShuffleOrder, playbackMode, playSurah, reciter?.surahs, surahId]);

  return {
    files,
    track,
    surahId,
    duration,
    /** Play is meaningful once the surah has a file behind it. */
    ready: Boolean(track),
    selectSurah,
    playSurah,
    seekTo,
    next,
    previous,
  };
}
