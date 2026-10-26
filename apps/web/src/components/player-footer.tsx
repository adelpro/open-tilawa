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
  onOpenSurahs,
  onOpenReciters,
  onOpenStream,
}: {
  surahName: string;
  reciterName: string;
  source: StreamSource;
  onOpenSurahs: () => void;
  onOpenReciters: () => void;
  onOpenStream: () => void;
}) {
  return (
    <footer className="shrink-0 border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-16 w-full max-w-[520px] items-center gap-1 px-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <button
            type="button"
            onClick={onOpenSurahs}
            aria-label="قائمة السور"
            className="flex h-8 min-w-0 items-center gap-2 rounded-full px-2 text-start text-[15px] font-semibold text-ink transition-colors hover:bg-line active:bg-line"
          >
            <Icon name="playlist" className="h-4 w-4 text-muted" />
            <span className="truncate">{surahName}</span>
          </button>

          <button
            type="button"
            onClick={onOpenReciters}
            aria-label="اختيار القارئ"
            className="flex h-7 min-w-0 items-center rounded-full px-2 text-start text-[12.5px] text-muted transition-colors hover:bg-line active:bg-line"
          >
            <span className="truncate">{reciterName}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenStream}
          aria-label={SOURCE_LABEL[source]}
          aria-haspopup="dialog"
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-line active:bg-line',
            source === 'connected' ? 'text-ink' : 'text-muted',
          )}
        >
          <Icon name={source === 'http' ? 'link' : 'wifi'} />
        </button>
      </div>
    </footer>
  );
}
