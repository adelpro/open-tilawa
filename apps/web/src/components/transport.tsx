import Icon from '@/components/icons';
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
        <Icon name="chevron-right" />
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
        {isPlaying ? <Icon name="pause" className="h-7 w-7" /> : <Icon name="play" className="h-7 w-7" />}
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
        <Icon name="chevron-left" />
      </button>
    </div>
  );
}
