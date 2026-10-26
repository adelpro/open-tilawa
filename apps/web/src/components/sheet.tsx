import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import Icon from '@/components/icons';
import { SURAHS } from '@/constants/surah';
import type { Reciter } from '@/types';
import { ayahCountLabel } from '@/utils/arabic-count';
import { cn } from '@/utils/cn';
import { formatBytes } from '@/utils/format-bytes';
import { filterReciters, filterSurahs } from '@/utils/search';

type SheetProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  /** `full` claims 90dvh, `peek` half of it, `auto` hugs its content. */
  size?: 'full' | 'peek' | 'auto';
  /** Rendered in the header before the close button (the expand toggle). */
  headerAction?: ReactNode;
  /** Pinned under the header, outside the scrolling body (search fields). */
  toolbar?: ReactNode;
  children: ReactNode;
};

/**
 * A bottom sheet built on native <dialog>: focus trapping, Escape, the top
 * layer and returning focus to the trigger all come from the platform.
 *
 * There is deliberately no `onClose` handler on the dialog element: closing
 * programmatically (the menu handing over to the page it links to) fires the
 * same `close` event as a dismissal, and treating the two alike closed both.
 */
export default function Sheet({
  title,
  open,
  onClose,
  size = 'full',
  toolbar,
  headerAction,
  children,
}: SheetProps) {
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
      <div
        className={cn(
          'flex flex-col',
          size === 'full' && 'h-[90dvh]',
          size === 'peek' && 'h-[46dvh]',
          size === 'auto' && 'max-h-[90dvh]',
        )}
      >
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <div className="flex items-center">
            {headerAction}
            <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="-me-2 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
          >
              <Icon name="close" />
            </button>
          </div>
        </div>

        {toolbar}

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

function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5">
      <Icon name="search" className="h-4 w-4 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-11 w-full min-w-0 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="مسح البحث"
          className="-me-2 flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

const row =
  'flex min-h-16 w-full items-center gap-3 px-5 py-2 text-start transition-colors hover:bg-line active:bg-line';

const dot = 'h-1 w-1 shrink-0 rounded-full bg-ink';

function Empty() {
  return <p className="px-5 py-10 text-center text-[13px] text-muted">لا نتائج</p>;
}

function Trailing({ children }: { children: ReactNode }) {
  return <span className="tnum shrink-0 text-[11px] text-muted">{children}</span>;
}

function useSurahRows() {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => filterSurahs(query), [query]);
  return { query, setQuery, rows };
}

/** Rows only: the search field above them belongs to whichever surface hosts them. */
function SurahRows({
  rows,
  current,
  sizes,
  onPick,
  scrollKey,
}: {
  rows: ReturnType<typeof useSurahRows>['rows'];
  current: number;
  sizes?: Record<number, number>;
  onPick: (surahId: number) => void;
  scrollKey: unknown;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector('[data-current="true"]')
        ?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollKey]);

  if (rows.length === 0) return <Empty />;

  return (
    <ul ref={listRef}>
      {rows.map((surah) => {
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

/**
 * The 114 surahs. On a phone this is a sheet that peeks at 46dvh and expands on
 * request, so the glyph and the transport stay in view while browsing; on a desk
 * the same rows live in a standing column beside the player.
 */
export function SurahSheet({
  open,
  current,
  sizes,
  onPick,
  onClose,
}: {
  open: boolean;
  current: number;
  sizes?: Record<number, number>;
  onPick: (surahId: number) => void;
  onClose: () => void;
}) {
  const { query, setQuery, rows } = useSurahRows();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (open) return;
    setExpanded(false);
    setQuery('');
  }, [open]);

  return (
    <Sheet
      title="السور"
      open={open}
      onClose={onClose}
      size={expanded ? 'full' : 'peek'}
      headerAction={
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? 'تصغير القائمة' : 'توسيع القائمة'}
          aria-expanded={expanded}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
        >
          <Icon name={expanded ? 'chevron-down' : 'chevron-up'} />
        </button>
      }
      toolbar={
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="ابحث باسم السورة أو رقمها"
          label="بحث في السور"
        />
      }
    >
      <SurahRows rows={rows} current={current} sizes={sizes} onPick={onPick} scrollKey={open} />
    </Sheet>
  );
}

/** The desk counterpart: no dialog, no backdrop, always present. */
export function SurahColumn({
  current,
  sizes,
  onPick,
}: {
  current: number;
  sizes?: Record<number, number>;
  onPick: (surahId: number) => void;
}) {
  const { query, setQuery, rows } = useSurahRows();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 items-center border-b border-line px-5">
        <h2 className="text-[15px] font-semibold">السور</h2>
      </div>
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="ابحث باسم السورة أو رقمها"
        label="بحث في السور"
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <SurahRows rows={rows} current={current} sizes={sizes} onPick={onPick} scrollKey="column" />
      </div>
    </div>
  );
}

/** One row per reciter: name, provenance, and whether peers are required. */
export function ReciterSheet({
  open,
  reciters,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  reciters: Reciter[];
  current: number | undefined;
  onPick: (reciter: Reciter) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => filterReciters(query, reciters), [query, reciters]);

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  return (
    <Sheet
      title="القرّاء"
      open={open}
      onClose={onClose}
      toolbar={
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="ابحث باسم القارئ"
          label="بحث في القرّاء"
        />
      }
    >
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <ul>
          {rows.map((reciter) => {
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
                      <span
                        className={cn('truncate text-[16px] text-ink', isCurrent && 'font-semibold')}
                      >
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
      )}
    </Sheet>
  );
}
