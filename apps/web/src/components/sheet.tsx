import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { Headphones, Heart } from '@phosphor-icons/react';

import type { IconName } from '@/components/icons';
import Icon from '@/components/icons';
import { SURAHS } from '@/constants/surah';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { Reciter } from '@/types';
import { cn } from '@/utils/cn';
import { useLocale } from '@/hooks/use-locale';
import { SURAH_NAMES_EN } from '@/i18n/surah-names-en';
import { formatBytes } from '@/utils/format-bytes';
import { riwayaLabel } from '@/utils/riwaya';
import { filterReciters, filterSurahs } from '@/utils/search';
import FavoriteButton from '@/components/favorite-button';
import { useGlobalCounts } from '@/hooks/use-global-counts';
import { myFavoritesAtom, myRecentAtom } from '@/jotai/gun';

/**
 * `mine` and `recent` are the listener's own lists; the other three order the
 * whole roster by a public number.
 */
type ReciterScope = 'default' | 'mine' | 'recent' | 'favorites' | 'views';

type SheetProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  /** `full` claims 90dvh; `auto` hugs its rows (the route menu). */
  size?: 'full' | 'auto';
  /** Pinned under the header, outside the scrolling body (the search field). */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Desktop only: keep the panel docked while rows are picked. */
  pinned?: boolean;
  onTogglePin?: () => void;
};

function PinGlyph({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M9 3h6l-1 5 4 4H6l4-4-1-5Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 12v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

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
 * A bottom sheet built on native <dialog> on a phone, and a docked, non-modal
 * panel on a desktop. The phone keeps the platform's focus trap and top layer;
 * the desktop keeps the stage visible, because a sheet on a 1440px screen is a
 * phone gesture in a room that does not need it.
 */
export default function Sheet({
  title,
  open,
  onClose,
  size = 'full',
  toolbar,
  children,
  pinned = false,
  onTogglePin,
}: SheetProps) {
  const { t } = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wide = useMediaQuery('(min-width: 1024px)');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  /** The panel is not modal, so Escape has to be caught at the window. */
  useEffect(() => {
    if (!wide || !open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wide, open, onClose]);

  if (wide) {
    return (
      <aside
        aria-label={title}
        className={cn(
          'fixed inset-y-0 start-0 z-30 mt-14 w-[360px] flex-col border-e border-line bg-canvas text-ink',
          open ? 'flex' : 'hidden',
        )}
      >
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <div className="flex items-center gap-1">
            {onTogglePin ? (
              <button
                type="button"
                onClick={onTogglePin}
                aria-pressed={pinned}
                aria-label={pinned ? t.common.unpin : t.common.pin}
                title={pinned ? t.common.unpin : t.common.pin}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:text-ink',
                  pinned ? 'text-ink' : 'text-muted',
                )}
              >
                <PinGlyph filled={pinned} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              className="-me-2 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
            >
              <CloseGlyph />
            </button>
          </div>
        </div>
        {toolbar}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </aside>
    );
  }

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
          <div className="flex items-center gap-1">
            {onTogglePin ? (
              <button
                type="button"
                onClick={onTogglePin}
                aria-pressed={pinned}
                aria-label={pinned ? t.common.unpin : t.common.pin}
                title={pinned ? t.common.unpin : t.common.pin}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:text-ink',
                  pinned ? 'text-ink' : 'text-muted',
                )}
              >
                <PinGlyph filled={pinned} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              className="-me-2 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
            >
              <CloseGlyph />
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
  const { t } = useLocale();

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-4">
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
          aria-label={t.sheets.clear}
          className="-me-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ink"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Empty() {
  const { t } = useLocale();
  return <p className="px-5 py-10 text-center text-[13px] text-muted">{t.sheets.empty}</p>;
}

/** The roster is remote now: an outage must say so, not look like an empty list. */
function RosterError({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-[13px] text-muted">{t.sheets.recitersError}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 h-11 px-3 text-[13px] font-semibold text-ink underline underline-offset-4"
      >
        {t.player.retry}
      </button>
    </div>
  );
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
  pinned,
  onTogglePin,
}: {
  open: boolean;
  current: number;
  /** Bytes per surah id, once the torrent's metadata has landed. */
  sizes?: Record<number, number>;
  onPick: (surahId: number) => void;
  onClose: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
}) {
  const { t, locale } = useLocale();
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
      pinned={pinned}
      onTogglePin={onTogglePin}
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
                      {locale === 'ar' ? surah.name : SURAH_NAMES_EN[surah.id] ?? surah.name}
                    </span>
                    <span className={meta}>
                      {t.sheets.verses(surah.ayahCount)} · {t.sheets.juz(surah.juz)}
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
  error = false,
  onRetry,
  pinned,
  onTogglePin,
  onLoadMore,
  loading,
  hasMore,
}: {
  open: boolean;
  reciters: Reciter[];
  current: number | undefined;
  onPick: (reciter: Reciter) => void;
  onClose: () => void;
  error?: boolean;
  onRetry?: () => void;
  pinned?: boolean;
  onTogglePin?: () => void;
  onLoadMore?: () => void;
  loading?: boolean;
  hasMore?: boolean;
}) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [scope, setScope] = useState<ReciterScope>('default');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { viewCounts, favCounts } = useGlobalCounts();
  const favorites = useAtomValue(myFavoritesAtom);
  const recent = useAtomValue(myRecentAtom);

  const riwayas = useMemo(
    () => Array.from(new Set(reciters.map((r) => r.riwaya).filter(Boolean))) as string[],
    [reciters],
  );

  const rows = useMemo(() => {
    let searched = filterReciters(query, reciters);
    if (filter !== 'all') {
      searched = searched.filter((r) => (r.riwaya || 'unknown') === filter);
    }

    // Personal scopes keep the order the listener made, not catalogue order:
    // favourites stay in the roster's order, history stays newest first.
    if (scope === 'mine') {
      return searched.filter((r) => favorites.includes(String(r.id)));
    }
    if (scope === 'recent') {
      const position = new Map(recent.map((entry, index) => [entry.id, index]));
      return searched
        .filter((r) => position.has(String(r.id)))
        .sort((a, b) => (position.get(String(a.id)) ?? 0) - (position.get(String(b.id)) ?? 0));
    }

    if (scope === 'favorites') {
      return [...searched].sort(
        (a, b) => Number(favCounts[String(b.id)] || 0) - Number(favCounts[String(a.id)] || 0),
      );
    }
    if (scope === 'views') {
      return [...searched].sort(
        (a, b) => Number(viewCounts[String(b.id)] || 0) - Number(viewCounts[String(a.id)] || 0),
      );
    }
    return searched;
  }, [query, reciters, filter, scope, favCounts, viewCounts, favorites, recent]);

  useEffect(() => {
    if (open) return;
    setQuery('');
    setFilter('all');
    setScope('default');
  }, [open]);

  useEffect(() => {
    if (!open || !onLoadMore || !hasMore || loading || query || filter !== 'all') return;
    if (scope !== 'default') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, onLoadMore, hasMore, loading, query, filter, scope]);

  return (
    <Sheet
      title="القرّاء"
      open={open}
      onClose={onClose}
      pinned={pinned}
      onTogglePin={onTogglePin}
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
              { key: 'all', label: t.sheets.all },
              ...riwayas.map((name) => ({ key: name, label: riwayaLabel(name) })),
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
          <div className="flex gap-1.5 overflow-x-auto border-b border-line px-5 py-2">
            {(
              [
                ['default', t.sheets.sortDefault],
                ['mine', t.sheets.myFavorites],
                ['recent', t.sheets.myRecent],
                ['favorites', t.sheets.sortFavorites],
                ['views', t.sheets.sortViews],
              ] as [ReciterScope, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setScope(key)}
                aria-pressed={scope === key}
                className={cn(chip, scope === key ? chipOn : chipOff)}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      }
    >
      {error && rows.length === 0 ? (
        <RosterError onRetry={onRetry ?? (() => undefined)} />
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <ul>
          {rows.map((reciter) => {
            const isCurrent = reciter.id === current;
            const f = Number(favCounts[String(reciter.id)] || 0);
            const v = Number(viewCounts[String(reciter.id)] || 0);
            return (
              <li key={reciter.id}>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => onPick(reciter)}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={cn(row, 'flex-1')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate', isCurrent && 'font-semibold')}>
                        {reciter.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted">
                        <span>{reciter.complet ? t.sheets.complete : t.sheets.partial}</span>
                        <span className="inline-flex items-center gap-0.5">
                          <Heart size={11} weight="fill" aria-hidden="true" />
                          <span className="tnum">{f}</span>
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          <Headphones size={11} aria-hidden="true" />
                          <span className="tnum">{v}</span>
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[10.5px] text-ink">
                      {riwayaLabel(reciter.riwaya)}
                    </span>
                  </button>
                  <FavoriteButton reciterId={reciter.id} className="px-3" />
                </div>
              </li>
            );
          })}
          {!query && filter === 'all' && hasMore ? (
            <li>
              <div ref={sentinelRef} className="flex items-center justify-center py-4">
                {loading ? (
                  <div className="flex items-center gap-2 text-[13px] text-muted">
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>جاري التحميل...</span>
                  </div>
                ) : null}
              </div>
            </li>
          ) : null}
        </ul>
      )}
    </Sheet>
  );
}
