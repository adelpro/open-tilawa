import { type ReactNode, useEffect, useRef } from 'react';

import Icon from '@/components/icons';
import { SURAHS } from '@/constants/surah';
import type { Reciter } from '@/types';
import { ayahCountLabel } from '@/utils/arabic-count';
import { cn } from '@/utils/cn';
import { formatBytes } from '@/utils/format-bytes';

type SheetProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  /** `full` claims 90dvh (lists); `auto` hugs its content (menu, settings). */
  size?: 'full' | 'auto';
  children: ReactNode;
};

/**
 * A bottom sheet built on native <dialog>: focus trapping, Escape, the top
 * layer and returning focus to the trigger all come from the platform, so
 * there is no hand-rolled modal state to get wrong.
 */
export default function Sheet({ title, open, onClose, size = 'full', children }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click that lands on the <dialog> itself is a click on the backdrop;
        // everything inside sits in the panel below.
        if (event.target === dialogRef.current) onClose();
      }}
      className="sheet fixed inset-x-0 bottom-0 top-auto m-0 mx-auto w-full max-w-[520px] rounded-t-2xl border-t border-line bg-canvas p-0 text-ink backdrop:bg-black/30"
    >
      <div className={size === 'full' ? 'flex h-[90dvh] flex-col' : 'flex max-h-[90dvh] flex-col'}>
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="-me-2 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
          >
            <Icon name="close" />
          </button>
        </div>
        <div
          className={cn(
            'min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]',
            size === 'full' && 'flex-1',
          )}
        >
          {children}
        </div>
      </div>
    </dialog>
  );
}

const row =
  'flex min-h-16 w-full items-center gap-3 px-5 py-2 text-start transition-colors hover:bg-line active:bg-line';

const dot = 'h-1 w-1 shrink-0 rounded-full bg-ink';

function Trailing({ children }: { children: ReactNode }) {
  return <span className="tnum shrink-0 text-[11px] text-muted">{children}</span>;
}

/** The 114 surahs, mushaf order, opened at the one that is playing. */
export function SurahSheet({
  open,
  current,
  sizes,
  onPick,
}: {
  open: boolean;
  current: number;
  /** Bytes per surah id, once the torrent's metadata has landed. */
  sizes?: Record<number, number>;
  onPick: (surahId: number) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector('[data-current="true"]')
        ?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <ul ref={listRef}>
      {SURAHS.map((surah) => {
        const isCurrent = surah.id === current;
        const size = sizes?.[surah.id];
        return (
          <li key={surah.id}>
            <button
              type="button"
              onClick={() => onPick(surah.id)}
              aria-current={isCurrent ? 'true' : undefined}
              data-current={isCurrent}
              className={row}
            >
              <span className="tnum w-8 shrink-0 text-xs text-muted">{surah.id}</span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {isCurrent && <span aria-hidden="true" className={dot} />}
                  <span className={cn('truncate text-[16px] text-ink', isCurrent && 'font-semibold')}>
                    {surah.name}
                  </span>
                </span>
                <span className="tnum mt-0.5 block text-[11.5px] text-muted">
                  {ayahCountLabel(surah.ayahCount)} · الجزء {surah.juz}
                </span>
              </span>

              {size ? <Trailing>{formatBytes(size)}</Trailing> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** One row per reciter: name, provenance, and whether peers are required. */
export function ReciterSheet({
  reciters,
  current,
  onPick,
}: {
  reciters: Reciter[];
  current: number | undefined;
  onPick: (reciter: Reciter) => void;
}) {
  return (
    <ul>
      {reciters.map((reciter) => {
        const isCurrent = reciter.id === current;
        return (
          <li key={reciter.id}>
            <button
              type="button"
              onClick={() => onPick(reciter)}
              aria-current={isCurrent ? 'true' : undefined}
              className={row}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  {isCurrent && <span aria-hidden="true" className={dot} />}
                  <span className={cn('truncate text-[16px] text-ink', isCurrent && 'font-semibold')}>
                    {reciter.name}
                  </span>
                </span>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  {reciter.source} · {reciter.complet ? 'كامل' : 'جزئي'}
                </span>
              </span>

              <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10.5px] text-muted">
                {reciter.magnet ? 'P2P' : 'HTTP'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
