import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';

type Props = {
  canPlay: boolean;
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeekDelta: (seconds: number) => void;
  className?: string;
};

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M15 5l-7 7 7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
      <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />
    </svg>
  );
}

const ghost =
  'press flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-line hover:text-ink active:bg-line focus-visible:text-ink disabled:opacity-40 disabled:hover:text-muted disabled:hover:bg-transparent';

/**
 * Five controls, one row. In an RTL interface the row starts on the right, so
 * "previous" sits right of the play button and its chevron points right.
 */
export default function Transport({
  canPlay,
  isPlaying,
  onPlayPause,
  onPrevious,
  onNext,
  onSeekDelta,
  className,
}: Props) {
  const { t } = useLocale();

  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <button type="button" className={ghost} onClick={onPrevious} aria-label={t.transport.previous}>
        <ChevronRight />
      </button>

      <button
        type="button"
        className={ghost}
        onClick={() => onSeekDelta(-15)}
        disabled={!canPlay}
        aria-label={t.transport.back}
      >
        <span dir="ltr" className="tnum text-[13px] font-semibold">
          −15
        </span>
      </button>

      {/* The one physical control on the page: a hairline bevel at rest, a 1px
          lift on hover, a 1px sink on press. The rules live in globals.css —
          two comma-separated shadows are not something to express in a class. */}
      <button
        type="button"
        onClick={onPlayPause}
        disabled={!canPlay}
        aria-label={isPlaying ? t.transport.pause : t.transport.play}
        className="play-button mx-1 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ink text-invert disabled:opacity-30"
      >
        {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
      </button>

      <button
        type="button"
        className={ghost}
        onClick={() => onSeekDelta(15)}
        disabled={!canPlay}
        aria-label={t.transport.forward}
      >
        <span dir="ltr" className="tnum text-[13px] font-semibold">
          +15
        </span>
      </button>

      <button type="button" className={ghost} onClick={onNext} aria-label={t.transport.next}>
        <ChevronLeft />
      </button>
    </div>
  );
}
