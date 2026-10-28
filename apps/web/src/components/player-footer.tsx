import Icon from '@/components/icons';
import StreamSourceIcon from '@/components/stream-source-icon';
import { useLocale } from '@/hooks/use-locale';
import type { StreamSource } from '@/utils/stream-source';
import { cn } from '@/utils/cn';

/**
 * The mini-player: the surah is the title (tap for the list), the reciter is the
 * artist (tap for the roster), and the stream state sits at the far end, where
 * nothing important can be hit by accident.
 */
export default function PlayerFooter({
  surahName,
  reciterName,
  source,
  progress = 0,
  rate = 1,
  onOpenSurahs,
  onOpenReciters,
  onOpenStream,
  onOpenRate,
  muted,
  onToggleMute,
}: {
  surahName: string;
  reciterName: string;
  source: StreamSource;
  /** 0–1 of the torrent this session has; drives the ring, never a second badge. */
  progress?: number;
  /** Shown only when it deviates from 1x, so the default bar stays two labels. */
  rate?: number;
  onOpenRate: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onOpenSurahs: () => void;
  onOpenReciters: () => void;
  onOpenStream: () => void;
}) {
  const { t } = useLocale();
  const sourceLabel: Record<StreamSource, string> = {
    connected: t.source.connected,
    waiting: t.source.waiting,
    webseed: t.source.webseed,
    mixed: t.source.mixed,
  };
  const hasProgress = progress > 0.005;
  const percent = Math.round(progress * 100);
  const ring = 2 * Math.PI * 20;
  return (
    <footer className="theatre-footer shrink-0 border-t border-line pb-[env(safe-area-inset-bottom)]">
      {/* Same 16px gutter as the top bar: the ring should sit as far from the
          edge as the mark does, or it reads as pushed to the corner. */}
      <div className="mx-auto flex min-h-14 w-full max-w-[520px] items-center gap-0.5 px-4">
        <div className="theatre-names flex min-w-0 flex-1 flex-col">
          {/* Both rows start with an icon: the same shape means the same thing,
              so neither row reads as a caption. */}
          <button
            type="button"
            onClick={onOpenSurahs}
            aria-label={t.footer.list}
            className="press flex h-9 min-w-0 items-center gap-2 rounded-full px-2 text-start text-[15px] font-semibold text-ink transition-colors hover:bg-line active:bg-line"
          >
            <Icon name="playlist" className="h-4 w-4 text-muted" />
            <span className="min-w-0 flex-1 truncate">{surahName}</span>
          </button>

          <button
            type="button"
            onClick={onOpenReciters}
            aria-label={t.footer.reciter}
            className="press flex h-9 min-w-0 items-center gap-2 rounded-full px-2 text-start text-[12.5px] text-muted transition-colors hover:bg-line active:bg-line"
          >
            <Icon name="mic" className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">{reciterName}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? t.footer.unmute : t.footer.mute}
          aria-pressed={muted}
          className={cn(
            'press flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-line active:bg-line',
            muted ? 'text-ink' : 'text-muted',
          )}
        >
          <Icon name={muted ? 'volume-x' : 'volume'} className="h-[18px] w-[18px]" />
        </button>

        {Math.abs(rate - 1) > 0.001 && (
          <button
            type="button"
            onClick={onOpenRate}
            aria-label={t.footer.speedChange(`${Number(rate.toFixed(2))}x`)}
            className="press tnum h-11 shrink-0 rounded-full bg-line px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-line/70"
          >
            {Number(rate.toFixed(2))}x
          </button>
        )}

        <button
          type="button"
          onClick={onOpenStream}
          aria-label={
            hasProgress ? `${sourceLabel[source]}, ${percent}%` : sourceLabel[source]
          }
          aria-haspopup="dialog"
          className={cn(
            'press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-line active:bg-line',
            source === 'connected' ? 'text-ink' : 'text-muted',
          )}
        >
          <svg
            viewBox="0 0 44 44"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-11 w-11 -rotate-90 text-ink"
          >
            <circle
              cx="22"
              cy="22"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.22"
              strokeWidth="2"
            />
            <circle
              cx="22"
              cy="22"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={ring}
              strokeDashoffset={ring * (1 - progress)}
            />
          </svg>
          <StreamSourceIcon source={source} />
        </button>
      </div>
    </footer>
  );
}
