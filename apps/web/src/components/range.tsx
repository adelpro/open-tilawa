import React from 'react';

type Props = {
  currentTime: number;
  duration: number;
  setCurrentTime: (time: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  buffered?: number; // 0..1 fraction of duration buffered
};

export default function Range({
  currentTime,
  duration,
  setCurrentTime,
  audioRef,
  buffered = 0,
}: Props) {
  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = Math.min(100, Math.max(0, buffered * 100));

  return (
    <div className="relative h-1.5 w-full rounded-full bg-blue-200 dark:bg-blue-900/40">
      {/* Buffered (gray) */}
      <div
        className="absolute inset-y-0 start-0 rounded-full bg-gray-300 transition-[width] duration-150 dark:bg-gray-600"
        style={{ width: `${bufferedPct}%` }}
        aria-hidden="true"
      />
      {/* Played (blue) */}
      <div
        className="absolute inset-y-0 start-0 rounded-full bg-blue-600 transition-[width] duration-150"
        style={{ width: `${playedPct}%` }}
        aria-hidden="true"
      />
      {/* Native input for interaction */}
      <input
        type="range"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        min={0}
        max={duration || 0}
        value={currentTime}
        onChange={(event) => {
          if (audioRef.current) {
            const time = Number.parseFloat(event.target.value);
            setCurrentTime(time);
            audioRef.current.currentTime = time;
          }
        }}
        aria-label="Seek"
      />
    </div>
  );
}
