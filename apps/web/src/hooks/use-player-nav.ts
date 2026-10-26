import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useMemo } from 'react';

import { getPosition, patchState } from '@/hooks/use-persistence';
import { selectedReciterAtom } from '@/jotai/atom';
import {
  currentSurahIdAtom,
  durationAtom,
  isPlayingAtom,
  positionAtom,
  rateAtom,
  torrentAtom,
} from '@/jotai/player';
import { nextRate } from '@/utils/rate';
import { surahIdOf } from '@/utils/surah-id';
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
  const [rate, setRate] = useAtom(rateAtom);

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

  const cycleRate = useCallback(() => {
    const value = nextRate(rate);
    setRate(value);
    patchState({ rate: value });
  }, [rate, setRate]);

  const next = useCallback(() => playSurah(surahId + 1), [playSurah, surahId]);
  const previous = useCallback(() => playSurah(surahId - 1), [playSurah, surahId]);

  return {
    files,
    track,
    surahId,
    duration,
    rate,
    cycleRate,
    /** Play is meaningful once the surah has a file behind it. */
    ready: Boolean(track),
    selectSurah,
    playSurah,
    seekTo,
    next,
    previous,
  };
}
