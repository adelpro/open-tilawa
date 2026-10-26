import { useRef } from 'react';

import DetailsPopover, { type StreamSource } from '@/components/details-popover';
import Icon from '@/components/icons';
import type { TorrentInfo } from '@/types';
import { cn } from '@/utils/cn';
import { formatRate } from '@/utils/rate';

const SOURCE_LABEL: Record<StreamSource, string> = {
  connected: 'متصل عبر الأقران',
  waiting: 'بانتظار الأقران',
  http: 'يعمل من خادم القارئ',
};

/**
 * 56px of list and status. The list half is the "continues upward" bar the
 * player was missing; the other half keeps speed and stream health out of the
 * transport row, which stays five controls.
 */
export default function BottomBar({
  surahName,
  rate,
  source,
  torrent,
  detailsOpen,
  onOpenList,
  onCycleRate,
  onToggleDetails,
  onCloseDetails,
}: {
  surahName: string;
  rate: number;
  source: StreamSource;
  torrent: TorrentInfo | undefined;
  detailsOpen: boolean;
  onOpenList: () => void;
  onCycleRate: () => void;
  onToggleDetails: () => void;
  onCloseDetails: () => void;
}) {
  const signalRef = useRef<HTMLButtonElement>(null);

  return (
    <footer className="shrink-0 border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto w-full max-w-[520px] px-2">
        {detailsOpen && (
        <DetailsPopover
          source={source}
          torrent={torrent}
          onClose={onCloseDetails}
          returnFocusRef={signalRef}
        />
      )}

        <div className="flex h-14 items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenList}
          aria-label="قائمة السور"
          className="flex h-11 min-w-0 items-center gap-2 rounded-full px-2 text-[14px] text-ink transition-colors hover:bg-line active:bg-line"
        >
          <Icon name="playlist" className="text-muted" />
          <span className="truncate">{surahName}</span>
          <Icon name="chevron-up" className="h-4 w-4 text-muted" />
        </button>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onCycleRate}
            aria-label="سرعة التشغيل"
            className="tnum h-11 min-w-11 rounded-full px-2 text-[13px] font-semibold text-muted transition-colors hover:text-ink active:bg-line"
          >
            {formatRate(rate)}
          </button>

          <button
            ref={signalRef}
            type="button"
            onClick={onToggleDetails}
            aria-label={SOURCE_LABEL[source]}
            aria-expanded={detailsOpen}
            aria-haspopup="dialog"
              className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-line active:bg-line',
              source === 'connected' ? 'text-ink' : 'text-muted',
            )}
          >
            <Icon name="wifi" />
          </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
