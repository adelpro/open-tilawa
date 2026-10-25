'use client';

import { useCallback, useEffect, useRef } from 'react';

const STATE_KEY = 'tilawa:state';

export type PersistedState = {
  reciterId?: number;
  surahIndex?: number;
  position?: number;
  updatedAt?: number;
};

export function loadState(): PersistedState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedState;
  } catch {
    return {};
  }
}

export function saveState(patch: Partial<PersistedState>) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadState();
    const next = { ...current, ...patch, updatedAt: Date.now() };
    window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota — degrade gracefully
  }
}

/**
 * Hook that saves the current surah index + playback position for a reciter.
 * Call from MusicPlayer with the reciter id, current track index, and audio ref.
 */
export function usePlaybackPersistence(
  reciterId: number | undefined,
  currentTrackIndex: number,
  audioRef: React.RefObject<HTMLAudioElement | null>
) {
  const lastSave = useRef(0);
  const save = useCallback(() => {
    if (reciterId === undefined) return;
    const audio = audioRef.current;
    const position = audio ? audio.currentTime : 0;
    saveState({ reciterId, surahIndex: currentTrackIndex, position });
    // also keep a per-reciter key for future multi-reciter resume
    try {
      window.localStorage.setItem(
        `tilawa:progress:${reciterId}`,
        JSON.stringify({ surahIndex: currentTrackIndex, position, updatedAt: Date.now() })
      );
    } catch {
      // ignore
    }
  }, [reciterId, currentTrackIndex, audioRef]);

  // Save on track change
  useEffect(() => {
    save();
  }, [currentTrackIndex, save]);

  // Save periodically during playback (every 5s)
  useEffect(() => {
    const id = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      const now = Date.now();
      if (now - lastSave.current < 4000) return;
      lastSave.current = now;
      save();
    }, 5000);
    return () => clearInterval(id);
  }, [save, audioRef]);

  // Save on unmount / page hide
  useEffect(() => {
    const handler = () => save();
    window.addEventListener('pagehide', handler);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save();
    });
    return () => {
      window.removeEventListener('pagehide', handler);
      save();
    };
  }, [save]);
}
