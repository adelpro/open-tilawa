import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';
import { formatTime } from '@/utils/format-time';

type Props = {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  /** Screen-reader name; two scrubbers never coexist, so a default is fine. */
  ariaLabel?: string;
  className?: string;
};

/**
 * Elapsed, rail, remaining — right to left, like the transport beside it. The
 * rail is 3px; the input on top of it is 44px tall so a thumb is never the
 * thing you have to hit. No buffered layer: on a torrent that number moves for
 * reasons the listener cannot act on.
 */
export default function Scrubber({
  position,
  duration,
  onSeek,
  ariaLabel,
  className,
}: Props) {
  const { t } = useLocale();
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progress = safeDuration > 0 ? Math.min(100, (position / safeDuration) * 100) : 0;

  return (
    <div className={cn('flex w-full items-center gap-3', className)}>
      <span className="tnum w-11 shrink-0 text-xs text-muted">
        <span dir="ltr" className="inline-block">
          {formatTime(position)}
        </span>
      </span>

      <div className="group relative flex h-11 flex-1 items-center">
        <div className="relative h-[3px] w-full rounded-full bg-line">
          <div
            className="absolute inset-y-0 right-0 rounded-full bg-ink"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 h-2.5 w-2.5 rounded-full bg-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            style={{ right: `${progress}%`, transform: 'translate(50%, -50%)' }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={Math.round(progress * 10)}
          onChange={(event) => {
            if (safeDuration <= 0) return;
            onSeek((Number(event.target.value) / 1000) * safeDuration);
          }}
          aria-label={ariaLabel ?? t.scrubber.label}
          aria-valuetext={`${formatTime(position)} ${t.scrubber.of} ${formatTime(safeDuration)}`}
          disabled={safeDuration <= 0}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-default"
        />
      </div>

      <span className="tnum w-11 shrink-0 text-xs text-muted">
        <span dir="ltr" className="inline-block">
          {formatTime(safeDuration)}
        </span>
      </span>
    </div>
  );
}
