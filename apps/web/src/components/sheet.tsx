import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import type { IconName } from '@/components/icons';
import Icon from '@/components/icons';
import { SURAHS } from '@/constants/surah';
import type { Reciter } from '@/types';
import { cn } from '@/utils/cn';
import { ayahCountLabel } from '@/utils/arabic-count';
import { formatBytes } from '@/utils/format-bytes';
import { riwayaLabel } from '@/utils/riwaya';
import { filterReciters, filterSurahs } from '@/utils/search';

type SheetProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  /** `full` claims 90dvh; `auto` hugs its rows (the route menu). */
  size?: 'full' | 'auto';
  /** Pinned under the header, outside the scrolling body (the search field). */
  toolbar?: ReactNode;
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
export default function Sheet({
  title,
  open,
  onClose,
  size = 'full',
  toolbar,
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
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Escape while typing: a `type="search"` field consumes the key before
      // the dialog sees it as a cancel, so the sheet would stay open.
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
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
            <CloseGlyph />
          </button>
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
          className="-me-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Empty() {
  return <p className="px-5 py-10 text-center text-[13px] text-muted">لا نتائج</p>;
}

const row =
  'flex min-h-16 w-full items-center gap-3 px-5 py-2 text-start text-[16px] text-ink transition-colors hover:bg-line active:bg-line';

const meta = 'tnum mt-0.5 block text-[11.5px] text-muted';

const chip = 'h-8 shrink-0 rounded-full border px-3 text-[12.5px] transition-colors';
const chipOn = 'border-ink bg-ink font-semibold text-invert';
const chipOff = 'border-line text-ink hover:border-ink/40';

/** The 114 surahs, mushaf order, opened at the one that is playing. */
export function SurahSheet({
  open,
  current,
  sizes,
  onPick,
  onClose,
}: {
  open: boolean;
  current: number;
  /** Bytes per surah id, once the torrent's metadata has landed. */
  sizes?: Record<number, number>;
  onPick: (surahId: number) => void;
  onClose: () => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => filterSurahs(query), [query]);

  useEffect(() => {
    if (open) return;
    setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.querySelector('[data-current="true"]')?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Sheet
      title="السور"
      open={open}
      onClose={onClose}
      toolbar={
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="ابحث باسم السورة أو رقمها"
          label="بحث في السور"
        />
      }
    >
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <ul ref={listRef}>
          {rows.map((surah) => {
            const isCurrent = surah.id === current;
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
                    <span className={cn('block truncate', isCurrent && 'font-semibold')}>
                      {surah.name}
                    </span>
                    <span className={meta}>
                      {ayahCountLabel(surah.ayahCount)} · الجزء {surah.juz}
                    </span>
                  </span>
                  {sizes?.[surah.id] ? (
                    <span className="tnum shrink-0 text-[11px] text-muted">
                      {formatBytes(sizes[surah.id])}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

/** One row per reciter, catalogue order, with the current one in bold. */
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
  const [filter, setFilter] = useState('all');

  const riwayas = useMemo(
    () => Array.from(new Set(reciters.map((r) => r.riwaya).filter(Boolean))) as string[],
    [reciters],
  );

  const rows = useMemo(() => {
    const searched = filterReciters(query, reciters);
    if (filter === 'all') return searched;
    if (filter === 'p2p') return searched.filter((r) => r.magnet);
    if (filter === 'http') return searched.filter((r) => !r.magnet);
    return searched.filter((r) => (r.riwaya ?? 'حفص') === filter);
  }, [query, reciters, filter]);

  useEffect(() => {
    if (open) return;
    setQuery('');
  }, [open]);

  return (
    <Sheet
      title="القرّاء"
      open={open}
      onClose={onClose}
      toolbar={
        <>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="ابحث باسم القارئ"
            label="بحث في القرّاء"
          />
          <div className="flex gap-1.5 overflow-x-auto border-b border-line px-5 py-2.5">
            {[
              { key: 'all', label: 'الكل' },
              { key: 'p2p', label: 'P2P' },
              { key: 'http', label: 'HTTP' },
              ...riwayas.map((name) => ({ key: name, label: name })),
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                aria-pressed={filter === item.key}
                className={cn(chip, filter === item.key ? chipOn : chipOff)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
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
                    <span className={cn('block truncate', isCurrent && 'font-semibold')}>
                      {reciter.name}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-muted">
                      {riwayaLabel(reciter.riwaya)} · {reciter.complet ? 'كامل' : 'جزئي'}
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
