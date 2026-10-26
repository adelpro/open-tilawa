import { type ReactNode, useEffect, useRef } from 'react';

import { SURAHS } from '@/constants/surah';
import type { Reciter } from '@/types';
import { cn } from '@/utils/cn';

type SheetProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A bottom sheet built on native <dialog>: focus trapping, Escape, the top
 * layer and returning focus to the trigger all come from the platform, so
 * there is no hand-rolled modal state to get wrong.
 */
export default function Sheet({ title, open, onClose, children }: SheetProps) {
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
      <div className="flex h-[90dvh] flex-col">
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="-me-2 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
          >
            <CloseGlyph />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </div>
    </dialog>
  );
}

const row =
  'flex h-14 w-full items-center gap-3 px-5 text-start text-[16px] text-ink transition-colors hover:bg-line active:bg-line';

/** The 114 surahs, mushaf order, opened at the one that is playing. */
export function SurahSheet({
  open,
  current,
  onPick,
}: {
  open: boolean;
  current: number;
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
        return (
          <li key={surah.id}>
            <button
              type="button"
              onClick={() => onPick(surah.id)}
              aria-current={isCurrent ? 'true' : undefined}
              data-current={isCurrent}
              className={cn(row, isCurrent && 'font-semibold')}
            >
              <span className="tnum w-8 shrink-0 text-xs text-muted">{surah.id}</span>
              <span>{surah.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** One row per reciter, catalogue order, with the current one in bold. */
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
              className={cn(row, isCurrent && 'font-semibold')}
            >
              <span>{reciter.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
