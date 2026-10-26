import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Icon } from '@/components/icons';
import { Equalizer, Fidelity } from '@/components/player-bits';
import { surahById } from '@/constants/surah';
import { usePlayerNav, surahIdOf } from '@/hooks/use-player-nav';
import { selectedReciterAtom } from '@/jotai/atom';
import {
  currentIndexAtom,
  isPlayingAtom,
  retrySignalAtom,
  shuffleAtom,
  shuffleOrderAtom,
  torrentAtom,
  torrentErrorAtom,
} from '@/jotai/player';
import type { TrackType } from '@/types';
import { cn } from '@/utils/cn';
import { formatBytes } from '@/utils/format-bytes';
import { nextIndex, playOrder, splitQueue } from '@/utils/queue';

type Props = {
  /** Called after a row is chosen — used to close the mobile sheet. */
  onPick?: () => void;
  className?: string;
};

function fileNameSize(track: TrackType): number | null {
  const length = (track.file as { length?: number } | undefined)?.length;
  return typeof length === 'number' && length > 0 ? length : null;
}

function QueueRow({
  index,
  track,
  active,
  playing,
  onPick,
}: {
  index: number;
  track: TrackType;
  active: boolean;
  playing: boolean;
  onPick: () => void;
}) {
  const surahId = surahIdOf(track, index);
  const surah = surahById(surahId);
  const size = fileNameSize(track);

  return (
    <button
      type="button"
      onClick={onPick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-start transition-colors',
        'hover:bg-surface-2/60 focus-visible:bg-surface-2/60',
        active && 'bg-surface-2/40',
      )}
    >
      <span className="tnum w-6 shrink-0 text-[11px] text-ink-tertiary">
        {String(surahId).padStart(3, '0')}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[15px]',
          active ? 'font-semibold text-ink' : 'text-ink',
        )}
      >
        {surah?.name ?? `سورة ${surahId}`}
      </span>
      {active ? (
        <Equalizer active={playing} className="text-accent" />
      ) : (
        <span className="tnum shrink-0 text-[11px] text-ink-tertiary">
          {size ? formatBytes(size) : '—'}
        </span>
      )}
    </button>
  );
}

/**
 * The queue is the mushaf, fixed. You can search it, you can shuffle the part
 * you have not heard yet, and you can jump backwards — but you cannot drag a
 * surah out of order, because the order is the point.
 */
export default function Queue({ onPick, className }: Props) {
  const torrent = useAtomValue(torrentAtom);
  const error = useAtomValue(torrentErrorAtom);
  const reciter = useAtomValue(selectedReciterAtom);
  const index = useAtomValue(currentIndexAtom);
  const playing = useAtomValue(isPlayingAtom);
  const [shuffle, setShuffle] = useAtom(shuffleAtom);
  const [order, setOrder] = useAtom(shuffleOrderAtom);
  const setRetry = useSetAtom(retrySignalAtom);

  const [query, setQuery] = useState('');
  const currentRef = useRef<HTMLButtonElement | null>(null);
  const { playIndex } = usePlayerNav();

  const files = torrent?.files ?? [];
  const walk = useMemo(() => playOrder(files.length, shuffle, order), [files.length, shuffle, order]);

  useEffect(() => {
    if (shuffle && order.length !== files.length && files.length > 0) {
      setOrder(playOrder(files.length, true, []));
    }
    if (!shuffle && order.length > 0) setOrder([]);
  }, [shuffle, order.length, files.length, setOrder]);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const { upcoming, previous } = useMemo(() => splitQueue(walk, index), [walk, index]);

  const filtered = useMemo(() => {
    const term = query.trim();
    if (!term) return null;
    return files
      .map((track, at) => ({ track, at }))
      .filter(({ track, at }) => {
        const id = surahIdOf(track, at);
        const name = surahById(id)?.name ?? '';
        return name.includes(term) || String(id).includes(term) || String(id).padStart(3, '0') === term;
      });
  }, [files, query]);

  const pick = (at: number) => {
    playIndex(at);
    onPick?.();
  };

  const rows = (indices: number[]) =>
    indices.map((at) => {
      const track = files[at];
      if (!track) return null;
      return (
        <QueueRow
          key={at}
          index={at}
          track={track}
          active={at === index}
          playing={playing}
          onPick={() => pick(at)}
        />
      );
    });

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <header className="shrink-0 px-4 pb-3 pt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">قائمة التشغيل</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShuffle((value) => !value)}
              aria-pressed={shuffle}
              title={shuffle ? 'ترتيب المصحف' : 'خلط ما تبقّى'}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                shuffle ? 'text-accent' : 'text-ink-secondary hover:text-ink',
              )}
            >
              <Icon name="shuffle" size={17} />
            </button>
            <span className="tnum text-[11px] text-ink-tertiary">
              {files.length > 0 ? `${files.length} سورة` : '—'}
            </span>
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 rounded-md border border-divider px-2.5">
          <Icon name="search" size={15} className="shrink-0 text-ink-tertiary" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن سورة"
            className="h-9 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-tertiary"
          />
        </label>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        {error && (
          <div className="m-2 rounded-md border border-divider p-3 text-sm text-ink-secondary">
            <p className="mb-2">{error}</p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="rounded-pill bg-ink px-3 py-1.5 text-xs font-semibold text-canvas"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {!error && files.length === 0 && (
          <p className="px-2 py-6 text-center text-xs leading-relaxed text-ink-tertiary">
            {reciter ? 'جارٍ تحضير التلاوة…' : 'اختر قارئًا من المكتبة أولًا.'}
          </p>
        )}

        {filtered && (
          <section aria-label="نتائج البحث" className="pt-1">
            <p className="px-2 pb-1 pt-2 text-[11px] text-ink-tertiary">
              {filtered.length} نتيجة
            </p>
            {filtered.map(({ track, at }) => (
              <QueueRow
                key={at}
                index={at}
                track={track}
                active={at === index}
                playing={playing}
                onPick={() => pick(at)}
              />
            ))}
          </section>
        )}

        {!filtered && files.length > 0 && (
          <>
            {index >= 0 && index < files.length && (
              <button
                ref={currentRef}
                type="button"
                onClick={() => pick(index)}
                className="flex w-full items-center gap-3 rounded-md bg-surface-2/50 px-2 py-2.5 text-start"
              >
                <span className="tnum w-6 shrink-0 text-[11px] text-ink-tertiary">
                  {String(surahIdOf(files[index], index)).padStart(3, '0')}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                  {surahById(surahIdOf(files[index], index))?.name ?? '—'}
                </span>
                <Equalizer active={playing} className="text-accent" />
              </button>
            )}

            {upcoming.length > 0 && (
              <section aria-label="التالي" className="pt-4">
                <h3 className="px-2 pb-1 text-[11px] font-semibold text-ink-tertiary">
                  {index < 0 ? 'السور' : 'التالي'}
                </h3>
                {rows(upcoming)}
              </section>
            )}

            {previous.length > 0 && (
              <section aria-label="السابق" className="pt-4">
                <h3 className="px-2 pb-1 text-[11px] font-semibold text-ink-tertiary">
                  السابق
                </h3>
                {rows(previous)}
              </section>
            )}

            {upcoming.length === 0 && previous.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-ink-tertiary">
                نهاية القائمة.
              </p>
            )}
          </>
        )}
      </div>

      {torrent && (
        <footer className="shrink-0 border-t border-divider px-4 py-2.5">
          <div className="flex items-center justify-between text-[11px] text-ink-tertiary">
            <Fidelity p2p={Boolean(reciter?.magnet)} />
            <span className="tnum">
              {torrent.peers} قرين · {(torrent.downloadSpeed / 1024).toFixed(0)} ك.ب/ث
            </span>
          </div>
        </footer>
      )}
    </div>
  );
}
