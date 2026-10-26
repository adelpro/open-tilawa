import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';

import { usePlayerNav, surahIdOf } from '@/hooks/use-player-nav';
import { getPosition, setPosition } from '@/hooks/use-persistence';
import useTorrent from '@/hooks/use-torrent';
import { selectedReciterAtom, webtorrentReadyAtom } from '@/jotai/atom';
import {
  bufferedAtom,
  currentIndexAtom,
  durationAtom,
  isPlayingAtom,
  positionAtom,
  rateAtom,
  repeatAtom,
  torrentAtom,
  torrentErrorAtom,
} from '@/jotai/player';
import { surahById } from '@/constants/surah';
import { audioRef as sharedAudio } from '@/utils/audio-ref';

/**
 * The only <audio> element in the app, mounted once outside <Routes> so that
 * playback and the torrent session survive navigation (design doc §7).
 *
 * It owns nothing about *which* surah is selected — the route does — and
 * writes nothing to the URL except when a track ends and the queue advances.
 */

function getStreamURL(file: unknown): string | undefined {
  try {
    const candidate = file as { streamURL?: string } | null;
    return typeof candidate?.streamURL === 'string' ? candidate.streamURL : undefined;
  } catch {
    return undefined;
  }
}

export default function AudioEngine() {
  const { torrentInfo, error } = useTorrent();
  const setTorrent = useSetAtom(torrentAtom);
  const setTorrentError = useSetAtom(torrentErrorAtom);
  const setWebtorrentReady = useSetAtom(webtorrentReadyAtom);

  const reciter = useAtomValue(selectedReciterAtom);
  const torrent = useAtomValue(torrentAtom);
  const index = useAtomValue(currentIndexAtom);
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom);
  const repeat = useAtomValue(repeatAtom);
  const rate = useAtomValue(rateAtom);
  const setPositionAtom = useSetAtom(positionAtom);
  const setDuration = useSetAtom(durationAtom);
  const setBuffered = useSetAtom(bufferedAtom);

  const { next, previous } = usePlayerNav();
  const audioRef = useRef<HTMLAudioElement>(null);
  const selectedFileRef = useRef<any>(null);
  const restoredForRef = useRef<number | null>(null);
  const lastSurahRef = useRef<number | undefined>(undefined);
  const trackRef = useRef(torrent?.files[index]);
  trackRef.current = torrent?.files[index];

  const files = torrent?.files ?? [];
  const track = files[index];
  const surahId = track ? surahIdOf(track, index) : undefined;

  /** Mirror the torrent hook into atoms so the queue and the desk can read it. */
  useEffect(() => {
    setTorrent(torrentInfo);
  }, [torrentInfo, setTorrent]);

  useEffect(() => {
    setTorrentError(error);
  }, [error, setTorrentError]);

  /** Load WebTorrent from the static bundle once. */
  useEffect(() => {
    if ((window as any).WebTorrent) {
      setWebtorrentReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod: any = await new Function('return import("/webtorrent.min.js")')();
        if (cancelled) return;
        (window as any).WebTorrent = mod?.default || mod;
        setWebtorrentReady(true);
      } catch {
        if (!cancelled) setWebtorrentReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setWebtorrentReady]);

  /** Swap the source when the surah changes. */
  useEffect(() => {
    const audio = audioRef.current;
    const current = trackRef.current;
    if (!audio || !current) return;

    // Park the outgoing surah under its own id before the source changes, or
    // "next" would record the new surah at the old surah's timestamp.
    const outgoing = lastSurahRef.current;
    if (reciter && outgoing && outgoing !== surahId && audio.currentTime > 0) {
      setPosition(reciter.id, outgoing, audio.currentTime);
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
  }, [surahId, (track as any)?.link, torrent?.magnetURI]);

  /** Play / pause. Deliberately does not re-assign src. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  }, [isPlaying, surahId, setIsPlaying]);

  /** Speed lives in the overflow menu; default 1. */
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate, surahId]);

  /** Persist the position while playing, when paused, and before the tab dies. */
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
    window.addEventListener('beforeunload', persist);
    window.addEventListener('pagehide', persist);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('beforeunload', persist);
      window.removeEventListener('pagehide', persist);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (audio.buffered.length > 0 && audio.duration > 0) {
      setBuffered(audio.buffered.end(audio.buffered.length - 1) / audio.duration);
    }
  };

  const handleEnded = () => {
    const audio = audioRef.current;
    if (repeat === 'one' && audio) {
      audio.currentTime = 0;
      audio.play().catch(() => setIsPlaying(false));
      return;
    }
    next();
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
      title: surah ? `سورة ${surah.name}` : `سورة ${surahId}`,
      artist: reciter?.name || 'Open Tilawa',
      album: 'Open Tilawa',
      artwork: [{ src: '/images/logo.png', sizes: '1024x1024', type: 'image/png' }],
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
  }, [surahId, reciter, next, setIsPlaying]);

  /** The tab title is the one place a listener sees the surah while elsewhere. */
  useEffect(() => {
    const surah = surahId ? surahById(surahId) : undefined;
    document.title = surah ? `${surah.name} — Open Tilawa` : 'Open Tilawa';
  }, [surahId]);

  return (
    <audio
      ref={audioRef}
      onTimeUpdate={handleTimeUpdate}
      onDurationChange={handleTimeUpdate}
      onLoadedMetadata={restorePosition}
      onSeeked={persist}
      onEnded={handleEnded}
      onError={() => console.error('Audio playback error')}
      className="hidden"
      preload="metadata"
    />
  );
}
