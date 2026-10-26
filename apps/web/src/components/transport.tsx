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
  'flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-ink focus-visible:text-ink disabled:opacity-40 disabled:hover:text-muted';

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
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <button
        type="button"
        className={ghost}
        onClick={onPrevious}
        aria-label="السورة السابقة"
      >
        <ChevronRight />
      </button>

      <button
        type="button"
        className={ghost}
        onClick={() => onSeekDelta(-15)}
        disabled={!canPlay}
        aria-label="ارجع 15 ثانية"
      >
        <span dir="ltr" className="tnum text-[13px] font-semibold">
          −15
        </span>
      </button>

      <button
        type="button"
        onClick={onPlayPause}
        disabled={!canPlay}
        aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
        className="mx-1 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ink text-invert transition-transform active:scale-[0.97] disabled:opacity-30 disabled:active:scale-100"
      >
        {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
      </button>

      <button
        type="button"
        className={ghost}
        onClick={() => onSeekDelta(15)}
        disabled={!canPlay}
        aria-label="تقدم 15 ثانية"
      >
        <span dir="ltr" className="tnum text-[13px] font-semibold">
          +15
        </span>
      </button>

      <button type="button" className={ghost} onClick={onNext} aria-label="السورة التالية">
        <ChevronLeft />
      </button>
    </div>
  );
}
