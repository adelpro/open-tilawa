import backwardSVG from '@svgs/music-backward.svg';
import downloadSVG from '@svgs/download.svg';
import forwardSVG from '@svgs/music-forward.svg';
import pauseSVG from '@svgs/music-pause.svg';
import playSVG from '@svgs/music-play.svg';
import playlistSVG from '@svgs/music-playlist.svg';
import repeatSVG from '@svgs/music-repeat.svg';
import shuffleSVG from '@svgs/music-shuffle.svg';
import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { TrackType } from '@/types';
import { useAtomValue } from 'jotai';
import { selectedReciterAtom } from '@/jotai/atom';
import { usePlaybackPersistence, loadState } from '@/hooks/use-persistence';

import PlaylistDialog from './playlist-dialog';
import Range from './range';
import TrackInfo from './track-info';

interface MusicPlayerProps {
  playlist: TrackType[];
}

export default function MusicPlayer({ playlist }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [buffered, setBuffered] = useState<number>(0);
  const [currentTrack, setCurrentTrack] = useState<number>(0);
  const selectedReciter = useAtomValue(selectedReciterAtom);
  const reciterId = selectedReciter?.id;
  const [seedIndex, setSeedIndex] = useState<number>(0);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [shuffledIndices, setShuffledIndices] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  usePlaybackPersistence(reciterId, currentTrack, audioRef);

  const shufflePlaylist = useCallback(() => {
    const indices = Array.from({ length: playlist.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledIndices(indices);
  }, [playlist.length]);

  useEffect(() => {
    shufflePlaylist();
  }, [shufflePlaylist]);

  useEffect(() => {
    const st = loadState();
    if (st.reciterId === reciterId && typeof st.surahIndex === 'number' &&
        st.surahIndex >= 0 && st.surahIndex < playlist.length) {
      setCurrentTrack(st.surahIndex);
    }
  }, [reciterId, playlist.length]);

  useEffect(() => {
    setSeedIndex(0);
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || playlist.length === 0) return;
    const track = playlist[currentTrack];
    if (!track) return;

    audio.pause();
    try {
      audio.removeAttribute('src');
      audio.load();
    } catch {
      // ignore
    }

    if (track.link && seedIndex === 0) {
      audio.src = track.link;
      audio.load();
    } else if (track.file && typeof track.file.createReadStream === 'function') {
      const file = track.file as any;
      if (typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mpeg')) {
        const ms = new MediaSource();
        const url = URL.createObjectURL(ms);
        audio.src = url;
        ms.addEventListener('sourceopen', async () => {
          const sb = ms.addSourceBuffer('audio/mpeg');
          const reader = file.createReadStream();
          const pump = async () => {
            for await (const chunk of reader) {
              await new Promise<void>((resolve) => {
                if (sb.updating) {
                  sb.addEventListener('updateend', () => resolve(), { once: true });
                } else {
                  resolve();
                }
              });
              try { sb.appendBuffer(chunk as unknown as ArrayBuffer); } catch { /* ignore */ }
              // Update buffered progress from SourceBuffer
              if (sb.buffered.length > 0 && audio.duration > 0) {
                const end = sb.buffered.end(sb.buffered.length - 1);
                setBuffered(end / audio.duration);
              }
            }
            try { if (!sb.updating) ms.endOfStream(); } catch { /* ignore */ }
          };
          pump().catch((e) => console.error('MediaSource pump failed:', e));
        }, { once: true });
        audio.load();
      } else {
        const chunks: Uint8Array[] = [];
        const reader = file.createReadStream();
        (async () => {
          for await (const c of reader) chunks.push(c);
          const blob = new Blob(chunks as BlobPart[], { type: file.type || 'audio/mpeg' });
          const u = URL.createObjectURL(blob);
          audio.src = u;
          audio.load();
          if (isPlaying) audio.play().catch(() => {});
        })().catch((e) => console.error('P2P load failed:', e));
      }
    }

    if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [currentTrack, playlist, isPlaying, seedIndex]);

  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.play().catch(() => {});
    }
  }, [currentTrack, isPlaying]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(() => {});
      setIsPlaying(!isPlaying);
    }
  };
  const handleTimeUpdate = () => {
    if (!audioRef?.current) return;
    const audio = audioRef.current;
    if (!Number.isNaN(audio.duration)) setDuration(audio.duration);
    if (!Number.isNaN(audio.currentTime)) setCurrentTime(audio.currentTime);
    // Compute buffered fraction from audio.buffered (TimeRanges)
    if (audio.buffered.length > 0 && audio.duration > 0) {
      const end = audio.buffered.end(audio.buffered.length - 1);
      setBuffered(end / audio.duration);
    }
  };
  const handlePreviousTrack = () => setCurrentTrack(getPreviousTrackIndex(currentTrack));
  const handleNextTrack = () => setCurrentTrack(getNextTrackIndex(currentTrack));
  const handleDownload = () => {
    const track = playlist[currentTrack];
    if (!track) return;
    if (track.file && typeof track.file.createReadStream === 'function') {
      const chunks: Uint8Array[] = [];
      const reader = (track.file as any).createReadStream();
      (async () => {
        for await (const c of reader) chunks.push(c);
        const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (track.file && track.file.name) || `surah-${track.surahId}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })().catch(() => {});
    } else if (track.link) {
      const a = document.createElement('a');
      a.href = track.link;
      a.download = track.link.split('/').pop() || `surah-${track.surahId}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  const toggleShuffle = () => {
    if (!isShuffled) shufflePlaylist();
    setIsShuffled(!isShuffled);
  };
  const getNextTrackIndex = (currentIndex: number) => {
    if (isShuffled) {
      const i = shuffledIndices.indexOf(currentIndex);
      return shuffledIndices[(i + 1) % playlist.length];
    }
    return (currentIndex + 1) % playlist.length;
  };
  const getPreviousTrackIndex = (currentIndex: number) => {
    if (isShuffled) {
      const i = shuffledIndices.indexOf(currentIndex);
      return shuffledIndices[(i - 1 + playlist.length) % playlist.length];
    }
    return (currentIndex - 1 + playlist.length) % playlist.length;
  };

  const btnClass = 'flex h-9 w-9 items-center justify-center rounded text-ink-secondary transition-colors duration-200 hover:bg-gray-200 hover:text-ink dark:hover:bg-gray-700';

  // Update document title when tab is hidden (for browser tab preview)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && isPlaying && playlist[currentTrack]) {
        document.title = `▶ سورة ${playlist[currentTrack].surahId} — Open Tilawa`;
      } else {
        document.title = 'Open Tilawa';
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isPlaying, currentTrack, playlist]);

  // Media Session API — lock screen / notification controls
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!playlist[currentTrack]) return;
    const track = playlist[currentTrack];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `سورة ${track.surahId}`,
      artist: selectedReciter?.name || 'Open Tilawa',
      album: selectedReciter?.source || '',
      artwork: [{ src: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' }],
    });
    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play();
      setIsPlaying(true);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skip = details.seekOffset || 10;
      if (audioRef.current) {
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - skip);
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skip = details.seekOffset || 10;
      if (audioRef.current) {
        audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + skip);
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      if (currentTrack > 0) setCurrentTrack(currentTrack - 1);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (currentTrack < playlist.length - 1) setCurrentTrack(currentTrack + 1);
    });
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [currentTrack, playlist, selectedReciter, duration]);

  // Update media session position state
  useEffect(() => {
    if (!('mediaSession' in navigator) || !audioRef.current) return;
    if (navigator.mediaSession.setPositionState) {
      navigator.mediaSession.setPositionState({
        duration: duration || 0,
        playbackRate: 1,
        position: currentTime || 0,
      });
    }
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentTime, duration, isPlaying]);

  return (
    <div className="flex w-full flex-col items-center gap-8">
      {/* Player card */}
      <div className="relative w-full max-w-xl rounded-md border border-gray-200 bg-card p-2 shadow-sm dark:border-gray-700 dark:bg-card-dark">
        {/* Top-left badge: transport state (P2P / HTTP fallback) */}
        <div className="absolute left-2 top-2 flex items-center gap-1">
          {playlist[currentTrack] &&
            (typeof (playlist[currentTrack] as any).file?.createReadStream === 'function' ? (
              <span
                className="rounded border border-hairline bg-canvas px-1.5 py-0.5 text-[10px] text-gray-400 dark:bg-card-dark"
              >
                P2P
              </span>
            ) : (
              <span
                className="rounded border border-hairline bg-canvas px-1.5 py-0.5 text-[10px] text-gray-400 dark:bg-card-dark"
                title="يتم التشغيل من المصدر الاحتياطي (HTTP)"
              >
                HTTP
              </span>
            ))}
        </div>
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={handleTimeUpdate}
          onEnded={handleNextTrack}
          onLoadedMetadata={() => {
            const audio = audioRef.current;
            if (!audio) return;
            const st = loadState();
            if (st.reciterId === reciterId && st.surahIndex === currentTrack && typeof st.position === 'number') {
              try { audio.currentTime = st.position; } catch {}
            }
          }}
          onError={() => {
            console.error('Audio playback error');
          }}
          className="hidden"
        />

        {/* Track info */}
        <div className="mb-4 text-center pt-5">
          <TrackInfo currentTrackId={currentTrack} duration={duration} currentTime={currentTime} playlist={playlist} />
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <Range currentTime={currentTime} setCurrentTime={setCurrentTime} duration={duration} audioRef={audioRef} buffered={buffered} />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <button onClick={handleNextTrack} className={btnClass} aria-label="Next">
            <Image src={forwardSVG} alt="forward" width={20} height={20} />
          </button>
          <button onClick={togglePlayPause} className="flex h-9 w-9 items-center justify-center rounded bg-ink text-canvas transition-colors duration-200 opacity-90 hover:opacity-100" aria-label={isPlaying ? 'Pause' : 'Play'}>
            <Image src={isPlaying ? pauseSVG : playSVG} alt={isPlaying ? 'pause' : 'play'} width={22} height={22} />
          </button>
          <button onClick={handlePreviousTrack} className={btnClass} aria-label="Previous">
            <Image src={backwardSVG} alt="backward" width={20} height={20} />
          </button>
          <button onClick={handleDownload} className={btnClass} aria-label="Download" title="Download for offline">
            <Image src={downloadSVG} alt="download" width={20} height={20} />
          </button>
          <button onClick={toggleShuffle} className={btnClass} aria-label="Shuffle">
            <Image src={isShuffled ? shuffleSVG : repeatSVG} alt="shuffle" width={20} height={20} />
          </button>
          <button onClick={() => setIsOpen(!isOpen)} className={btnClass} aria-label="Playlist">
            <Image src={playlistSVG} alt="playlist" width={20} height={20} />
          </button>
        </div>
      </div>

      {/* Fixed status slot (reserved so the card layout doesn't jump) */}
      <div className="min-h-[52px] w-full max-w-xl" />

      <PlaylistDialog isOpen={isOpen} setIsOpen={setIsOpen} setCurrentTrack={setCurrentTrack} playlist={playlist} />
    </div>
  );
}