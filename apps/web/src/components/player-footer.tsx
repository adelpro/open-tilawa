import Icon from '@/components/icons';
import type { StreamSource } from '@/components/stream-sheet';
import { cn } from '@/utils/cn';

const SOURCE_LABEL: Record<StreamSource, string> = {
  connected: 'متصل عبر الأقران',
  waiting: 'بانتظار الأقران',
  http: 'يعمل من خادم القارئ',
};

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
  onOpenSurahs,
  onOpenReciters,
  onOpenStream,
}: {
  surahName: string;
  reciterName: string;
  source: StreamSource;
  /** 0–1 of the torrent this session has; drives the ring, never a second badge. */
  progress?: number;
  onOpenSurahs: () => void;
  onOpenReciters: () => void;
  onOpenStream: () => void;
}) {
  const showRing = source !== 'http' && progress > 0.01 && progress < 0.995;
  const percent = Math.round(progress * 100);
  const ring = 2 * Math.PI * 20;
  return (
    <footer className="shrink-0 border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-16 w-full max-w-[520px] items-center gap-1 px-2">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Both rows start with an icon: the same shape means the same thing,
              so neither row reads as a caption. */}
          <button
            type="button"
            onClick={onOpenSurahs}
            aria-label="قائمة السور"
            className="flex h-8 min-w-0 items-center gap-2 rounded-full px-2 text-start text-[15px] font-semibold text-ink transition-colors hover:bg-line active:bg-line"
          >
            <Icon name="playlist" className="h-4 w-4 text-muted" />
            <span className="min-w-0 flex-1 truncate">{surahName}</span>
          </button>

          <button
            type="button"
            onClick={onOpenReciters}
            aria-label="اختيار القارئ"
            className="flex h-8 min-w-0 items-center gap-2 rounded-full px-2 text-start text-[12.5px] text-muted transition-colors hover:bg-line active:bg-line"
          >
            <Icon name="mic" className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">{reciterName}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenStream}
          aria-label={
            showRing ? `${SOURCE_LABEL[source]}، التنزيل ${percent}%` : SOURCE_LABEL[source]
          }
          aria-haspopup="dialog"
          className={cn(
            'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-line active:bg-line',
            source === 'connected' ? 'text-ink' : 'text-muted',
          )}
        >
          {showRing && (
            <svg
              viewBox="0 0 44 44"
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-11 w-11 -rotate-90 text-ink"
            >
              <circle cx="22" cy="22" r="20" fill="none" stroke="var(--line)" strokeWidth="1.5" />
              <circle
                cx="22"
                cy="22"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - progress)}
              />
            </svg>
          )}
          <Icon name={source === 'http' ? 'link' : 'wifi'} />
        </button>
      </div>
    </footer>
  );
}
