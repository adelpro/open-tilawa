import { useRef } from 'react';

import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/format-time';

type Props = {
  position: number;
  duration: number;
  buffered?: number;
  onSeek: (seconds: number) => void;
  className?: string;
  /** Hide the timestamps (mini-player). */
  compact?: boolean;
};

/**
 * A scrubber that is honest about three things at once: where you are, what has
 * downloaded, and how far the file goes. The visible track is 4px; the touch
 * target is 44px, because this is the control people actually grab.
 */
export default function Scrubber({
  position,
  duration,
  buffered = 0,
  onSeek,
  className,
  compact = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progress = safeDuration > 0 ? Math.min(100, (position / safeDuration) * 100) : 0;
  const bufferedPct = safeDuration > 0 ? Math.min(100, buffered * 100) : 0;

  const handleSeek = (value: number) => {
    if (safeDuration <= 0) return;
    const seconds = (value / 1000) * safeDuration;
    onSeek(Math.max(0, Math.min(safeDuration, seconds)));
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-3">
        <div
          dir="ltr"
          className="group relative flex h-11 flex-1 items-center"
        >
          <div className="relative h-1 w-full overflow-visible rounded-pill bg-surface-2">
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-ink/20"
              style={{ width: `${bufferedPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-ink"
              style={{ width: `${progress}%` }}
            />
            <div
              className={cn(
                'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink',
                'opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
                progress > 0 && 'opacity-100',
              )}
              style={{ left: `${progress}%` }}
            />
          </div>
          <input
            ref={inputRef}
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.round((progress / 100) * 1000)}
            onChange={(event) => handleSeek(Number(event.target.value))}
            aria-label="موضع التشغيل"
            aria-valuetext={`${formatTime(position)} من ${formatTime(safeDuration)}`}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>
        {!compact && (
          <div dir="ltr" className="tnum flex shrink-0 gap-1.5 text-[11px] text-ink-secondary">
            <span>{formatTime(position)}</span>
            <span className="text-ink-tertiary">/</span>
            <span>{formatTime(safeDuration)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
