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
    const indices = Array.from(
      { length: playlist.length },
      (_, indice) => indice
    );
    for (let index = indices.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [indices[index], indices[randomIndex]] = [
        indices[randomIndex],
        indices[index],
      ];
    }
    setShuffledIndices(indices);
  }, [playlist.length]);

  useEffect(() => {
    shufflePlaylist();
  }, [shufflePlaylist]);

  // Restore last played surah on mount.
  useEffect(() => {
    const st = loadState();
    if (st.reciterId === reciterId && typeof st.surahIndex === 'number' &&
        st.surahIndex >= 0 && st.surahIndex < playlist.length) {
      setCurrentTrack(st.surahIndex);
    }
  }, [reciterId, playlist.length]);

  // Reset mirror index whenever the track changes.
  useEffect(() => {
    setSeedIndex(0);
  }, [currentTrack]);

  // Wire the audio source for the current track. Web-seed reciters stream over
  // plain HTTP (browser range requests); P2P-only reciters stream incrementally
  // via WebTorrent's streamTo() (MediaSource) instead of loading the whole file.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || playlist.length === 0) return;
    const track = playlist[currentTrack];
    if (!track) return;

    // Reset element before switching sources.
    audio.pause();
    try {
      audio.removeAttribute('src');
      audio.load();
    } catch {
      // ignore
    }

    const seeds = track.webSeeds && track.webSeeds.length ? track.webSeeds : [];
    const fileName = (track.file && track.file.name) ? track.file.name
      : (track.link ? track.link.split('/').pop() : '');
    if (seeds.length && seedIndex < seeds.length && seedIndex > 0) {
      const base = seeds[seedIndex];
      audio.src = base.endsWith('/') ? base + fileName : base + '/' + fileName;
      audio.load();
    } else if (track.link && seedIndex === 0) {
      audio.src = track.link;
      audio.load();
    } else if (track.file && typeof track.file.streamTo === 'function') {
      try {
        track.file.streamTo(audio);
      } catch (e) {
        console.error('streamTo failed, falling back to blob:', e);
        if (typeof track.file.getBlob === 'function') {
          track.file.getBlob((err: any, blob: Blob) => {
            if (err || !blob) return;
            const url = URL.createObjectURL(blob);
            audio.src = url;
            audio.load();
            if (isPlaying) audio.play().catch(() => {});
          });
        }
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
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };
  const handleTimeUpdate = () => {
    if (!audioRef?.current) return;
    if (!Number.isNaN(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
    if (!Number.isNaN(audioRef.current.currentTime)) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  const handlePreviousTrack = () => {
    setCurrentTrack(getPreviousTrackIndex(currentTrack));
  };
  const handleNextTrack = () => {
    setCurrentTrack(getNextTrackIndex(currentTrack));
  };
  const handleDownload = () => {
    const track = playlist[currentTrack];
    if (!track) return;
    if (track.file && typeof track.file.getBlob === 'function') {
      track.file.getBlob((err: any, blob: Blob) => {
        if (err || !blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (track.file && track.file.name) || `surah-${track.surahId}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      });
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
      const currentShuffledIndex = shuffledIndices.indexOf(currentIndex);
      return shuffledIndices[(currentShuffledIndex + 1) % playlist.length];
    }
    return (currentIndex + 1) % playlist.length;
  };
  const getPreviousTrackIndex = (currentIndex: number) => {
    if (isShuffled) {
      const currentShuffledIndex = shuffledIndices.indexOf(currentIndex);
      return shuffledIndices[
        (currentShuffledIndex - 1 + playlist.length) % playlist.length
      ];
    }
    return (currentIndex - 1 + playlist.length) % playlist.length;
  };

  return (
    <div className="flex w-full flex-col items-center justify-center gap-3">
      <div className="flex h-20 w-full max-w-md flex-col items-center justify-center rounded-t-md border border-slate-200 p-0 shadow-md transition-transform hover:scale-105">
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
            const t = playlist[currentTrack];
            if (t && t.webSeeds && seedIndex < t.webSeeds.length - 1) {
              setSeedIndex((i) => i + 1);
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 pt-5 md:gap-10">
          <button
            onClick={handlePreviousTrack}
            className="rounded p-1.5 transition-colors duration-200 hover:bg-slate-100"
          >
            <Image src={backwardSVG} alt="backward" width={20} height={20} />
          </button>
          <button
            onClick={togglePlayPause}
            className="rounded p-1.5 transition-colors duration-200 hover:bg-slate-100"
          >
            {isPlaying ? (
              <Image src={pauseSVG} alt="pause" width={20} height={20} />
            ) : (
              <Image src={playSVG} alt="play" width={20} height={20} />
            )}
          </button>
          <button
            onClick={handleNextTrack}
            className="rounded p-1.5 transition-colors duration-200 hover:bg-slate-100"
          >
            <Image src={forwardSVG} alt="forward" width={20} height={20} />
          </button>
          <button
            onClick={handleDownload}
            className="rounded p-1.5 transition-colors duration-200 hover:bg-slate-100"
            title="Download for offline"
          >
            <Image src={downloadSVG} alt="download" width={20} height={20} />
          </button>
          <button
            onClick={toggleShuffle}
            className="rounded p-1.5 transition-colors duration-200 hover:bg-slate-100"
          >
            {isShuffled ? (
              <Image src={shuffleSVG} alt="shuffle" width={20} height={20} />
            ) : (
              <Image src={repeatSVG} alt="repeat" width={20} height={20} />
            )}
          </button>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="rounded p-1.5 transition-colors duration-200 hover:bg-slate-100"
          >
            <Image src={playlistSVG} alt="playlist" width={20} height={20} />
          </button>
        </div>
        <Range
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          duration={duration}
          audioRef={audioRef}
        />
        <PlaylistDialog
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          setCurrentTrack={setCurrentTrack}
        />
      </div>
      <TrackInfo
        currentTrackId={currentTrack}
        duration={duration}
        currentTime={currentTime}
      />
    </div>
  );
}
