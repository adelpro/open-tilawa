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
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = Math.min(100, Math.max(0, buffered * 100));

  return (
    <div className="relative h-2 w-full" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Track background */}
      <div className="absolute inset-0 rounded-full bg-hairline" />
      {/* Buffered (gray) */}
      <div
        className="absolute inset-y-0 start-0 rounded-full bg-zinc-400/60 transition-[width] duration-150"
        style={{ width: `${bufferedPct}%` }}
        aria-hidden="true"
      />
      {/* Played (blue) */}
      <div
        className="absolute inset-y-0 start-0 rounded-full bg-primary transition-[width] duration-150"
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
      {/* Thumb */}
      <div
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded bg-primary shadow-premium transition-[inset-inline-start] duration-150"
        style={{ insetInlineStart: `calc(${playedPct}% - 8px)` }}
        aria-hidden="true"
      />
    </div>
  );
}