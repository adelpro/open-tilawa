import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';

import { usePlayerNav } from '@/hooks/use-player-nav';
import { flushPosition, getPosition, setPosition } from '@/hooks/use-persistence';
import useTorrent from '@/hooks/use-torrent';
import { selectedReciterAtom, webtorrentReadyAtom } from '@/jotai/atom';
import {
  currentSurahIdAtom,
  durationAtom,
  isPlayingAtom,
  positionAtom,
  mutedAtom,
  rateAtom,
  torrentAtom,
  torrentErrorAtom,
} from '@/jotai/player';
import { surahById } from '@/constants/surah';
import { useLocale } from '@/hooks/use-locale';
import { SURAH_NAMES_EN } from '@/i18n/surah-names-en';
import { audioRef as sharedAudio } from '@/utils/audio-ref';
import { ensureAnalyser } from '@/utils/audio-analyser';

/**
 * The only <audio> element in the app, mounted once next to the page.
 *
 * It owns nothing about *which* surah is selected — `currentSurahIdAtom` does —
 * and writes nothing except the stored position. Everything it publishes (the
 * element, the position, the duration) is read by the one screen above it.
 */

function getStreamURL(file: unknown): string | undefined {
  try {
    const candidate = file as { streamURL?: string } | null;
    return typeof candidate?.streamURL === 'string' ? candidate.streamURL : undefined;
  } catch {
    return undefined;
  }
}

/**
 * WebTorrent is a UMD bundle served from `public/`, not something Vite can
 * bundle. The URL is absolute so resolution never depends on the document's
 * base, and the classic-script fallback covers engines that refuse to parse a
 * UMD file as a module.
 */
async function loadWebTorrent(): Promise<void> {
  if ((window as any).WebTorrent) return;
  const url = new URL(`${import.meta.env.BASE_URL}webtorrent.min.js`, window.location.origin).href;

  try {
    const mod: any = await import(/* @vite-ignore */ url);
    const ctor = mod?.default ?? mod;
    if (typeof ctor === 'function') {
      (window as any).WebTorrent = ctor;
      return;
    }
  } catch {
    // fall through to the script tag
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('webtorrent bundle failed to load'));
    document.head.appendChild(script);
  });
}

export default function AudioEngine() {
  const { torrentInfo, error } = useTorrent();
  const setTorrent = useSetAtom(torrentAtom);
  const setTorrentError = useSetAtom(torrentErrorAtom);
  const setWebtorrentReady = useSetAtom(webtorrentReadyAtom);

  const reciter = useAtomValue(selectedReciterAtom);
  const surahId = useAtomValue(currentSurahIdAtom);
  const { t, locale } = useLocale();
  const rate = useAtomValue(rateAtom);
  const muted = useAtomValue(mutedAtom);
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom);
  const setPositionAtom = useSetAtom(positionAtom);
  const setDuration = useSetAtom(durationAtom);

  const { track, files, next, previous } = usePlayerNav();
  const audioRef = useRef<HTMLAudioElement>(null);
  const selectedFileRef = useRef<any>(null);
  const restoredForRef = useRef<number | null>(null);
  const lastSurahRef = useRef<number | undefined>(undefined);
  const trackRef = useRef(track);
  trackRef.current = track;

  const fileCount = files.length;
  const link = track?.link ?? '';
  const magnetURI = torrentInfo?.magnetURI ?? '';

  /** Mirror the torrent hook into atoms so the page can read it. */
  useEffect(() => {
    setTorrent(torrentInfo);
  }, [torrentInfo, setTorrent]);

  useEffect(() => {
    setTorrentError(error);
  }, [error, setTorrentError]);

  /** Load WebTorrent from the static bundle once. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadWebTorrent();
        if (!cancelled) setWebtorrentReady(true);
      } catch {
        if (cancelled) return;
        setWebtorrentReady(false);
        setTorrentError('تعذّر تحميل محرّك البث. تحقق من اتصالك ثم أعد المحاولة.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setTorrentError, setWebtorrentReady]);

  /** Swap the source when the surah changes (or its file finally lands). */
  useEffect(() => {
    const audio = audioRef.current;
    const current = trackRef.current;
    if (!audio || !current) return;

    // Park the outgoing surah under its own id before the source changes, or
    // "next" would record the new surah at the old surah's timestamp.
    const outgoing = lastSurahRef.current;
    if (reciter && outgoing && outgoing !== surahId && audio.currentTime > 0) {
      setPosition(reciter.id, outgoing, audio.currentTime);
      flushPosition();
    }
    lastSurahRef.current = surahId;

    audio.pause();
    try {
      audio.removeAttribute('src');
      audio.load();
    } catch {
      // ignore
    }
    const file = (current as any).file;
    const streamURL = getStreamURL(file);

    // One surah in flight: the previous file stops competing for pieces.
    if (file !== selectedFileRef.current) {
      try {
        selectedFileRef.current?.deselect?.();
      } catch {
        // ignore
      }
      selectedFileRef.current = null;
    }

    if (streamURL) {
      try {
        file?.select?.();
      } catch {
        // ignore
      }
      selectedFileRef.current = file;
      audio.src = streamURL;
      audio.load();
    } else if (current.link) {
      audio.src = current.link;
      audio.load();
    }

    restoredForRef.current = null;
  }, [surahId, link, magnetURI, fileCount, reciter]);

  /** Play / pause. Deliberately does not re-assign src. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !trackRef.current) return;
    if (isPlaying) {
      // The graph needs a gesture; this is one. If it fails, audio still plays.
      ensureAnalyser(audio);
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      persist();
      flushPosition();
    }
  }, [isPlaying, surahId, fileCount, setIsPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
  }, [muted, surahId]);

  /** Speed survives a surah change; it is the listener's, not the track's. */
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate, surahId, fileCount]);

  /** Persist the position; the writer coalesces, so callers stay dumb. */
  const persist = () => {
    const audio = audioRef.current;
    if (!audio || !reciter || !surahId) return;
    setPosition(reciter.id, surahId, audio.currentTime);
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      persist();
    }, 5000);
    // The tab is going away: the debounced write must land now.
    const flush = () => {
      persist();
      flushPosition();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
    // `persist` closes over reciter/surahId, which are the deps that matter.
  }, [reciter, surahId]);

  /** Publish the element for the scrubber, and clear it on unmount. */
  useEffect(() => {
    sharedAudio.current = audioRef.current;
    return () => {
      sharedAudio.current = null;
    };
  }, []);

  /** Release the in-flight file when the app goes away. */
  useEffect(
    () => () => {
      try {
        selectedFileRef.current?.deselect?.();
      } catch {
        // ignore
      }
      selectedFileRef.current = null;
    },
    [],
  );

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!Number.isNaN(audio.duration)) setDuration(audio.duration);
    if (!Number.isNaN(audio.currentTime)) setPositionAtom(audio.currentTime);
  };

  const restorePosition = () => {
    const audio = audioRef.current;
    if (!audio || !reciter || !surahId) return;
    if (restoredForRef.current === surahId) return;
    restoredForRef.current = surahId;
    const stored = getPosition(reciter.id);
    if (stored && stored.surahId === surahId && stored.position > 3) {
      try {
        audio.currentTime = stored.position;
      } catch {
        // the source may not be seekable yet
      }
    }
  };

  /** Lock screen / notification controls. */
  useEffect(() => {
    if (!('mediaSession' in navigator) || !surahId) return;
    const surah = surahById(surahId);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: surah
        ? locale === 'ar'
          ? `سورة ${surah.name}`
          : SURAH_NAMES_EN[surah.id] ?? surah.name
        : t.player.surah(surahId),
      artist: reciter?.name || 'Open Tilawa',
      album: 'Open Tilawa',
      // The lock screen and the media notification use the square mark, not the
      // wide wordmark raster: at thumbnail size the wordmark is a smudge.
      artwork: [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('previoustrack', () => previous());
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
    };
  }, [surahId, reciter, next, previous, setIsPlaying, locale, t]);

  /** The tab title is the one place a listener sees the surah while elsewhere. */
  useEffect(() => {
    const surah = surahById(surahId);
    const name = surah ? (locale === 'ar' ? surah.name : SURAH_NAMES_EN[surah.id] ?? surah.name) : '';
    document.title = name ? `${name} — Open Tilawa` : 'Open Tilawa';
  }, [surahId, locale]);

  return (
    <audio
      ref={audioRef}
      onTimeUpdate={handleTimeUpdate}
      onDurationChange={handleTimeUpdate}
      onLoadedMetadata={restorePosition}
      onSeeked={() => {
        persist();
        flushPosition();
      }}
      onEnded={() => next()}
      onError={() => console.error('Audio playback error')}
      className="hidden"
      preload="metadata"
    />
  );
}
