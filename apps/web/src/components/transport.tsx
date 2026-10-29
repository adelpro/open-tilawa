import Icon from '@/components/icons';
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

const ghost =
  'press flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-line hover:text-ink active:bg-line focus-visible:text-ink disabled:opacity-40 disabled:hover:text-muted disabled:hover:bg-transparent';

/**
 * Five controls, one row. The two skip glyphs are directions, not sides:
 * `back` points left in English and right in Arabic, so the row can mirror
 * with the document and the arrows still point where the sound goes. (They
 * used to be hardcoded left/right, which was right in Arabic and inverted in
 * English.)
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
        <Icon name="back" size={20} />
      </button>

      <button
        type="button"
        className={ghost}
        onClick={() => onSeekDelta(-15)}
        disabled={!canPlay}
        aria-label={t.transport.back}
      >
        <span dir="ltr" className="tnum text-[0.875rem] font-semibold">
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
        <Icon name={isPlaying ? 'pause' : 'play'} size={24} weight="fill" />
      </button>

      <button
        type="button"
        className={ghost}
        onClick={() => onSeekDelta(15)}
        disabled={!canPlay}
        aria-label={t.transport.forward}
      >
        <span dir="ltr" className="tnum text-[0.875rem] font-semibold">
          +15
        </span>
      </button>

      <button type="button" className={ghost} onClick={onNext} aria-label={t.transport.next}>
        <Icon name="forward" size={20} />
      </button>
    </div>
  );
}
