import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { Fidelity } from '@/components/player-bits';
import { surahById } from '@/constants/surah';
import { loadState } from '@/hooks/use-persistence';
import { useReciters } from '@/hooks/use-reciters';
import type { MagnetlinkSource } from '@/types';
import { cn } from '@/utils/cn';
import { hasHttpFallback } from '@/utils/reciter-meta';

/**
 * The library. A directory, not a gallery: no covers, because there are none —
 * what a listener needs to choose is who is reciting and how the audio reaches
 * them.
 */
export default function LibraryPage() {
  const { reciters } = useReciters();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<MagnetlinkSource | 'all'>('all');

  const state = useMemo(() => loadState(), []);
  const resumeReciter = state.reciterId
    ? reciters.find((reciter) => reciter.id === state.reciterId)
    : undefined;
  const resumePosition = state.reciterId ? state.positions[String(state.reciterId)] : undefined;
  const resumeSurah = resumePosition ? surahById(resumePosition.surahId) : undefined;

  const sources = useMemo(
    () => Array.from(new Set(reciters.map((reciter) => reciter.source))),
    [reciters],
  );

  const visible = useMemo(() => {
    const term = query.trim();
    return reciters
      .filter((reciter) => (term ? reciter.name.includes(term) : true))
      .filter((reciter) => source === 'all' || reciter.source === source)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [reciters, query, source]);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8 sm:px-8 lg:py-12">
      <header>
        <p className="badge-tech text-ink-tertiary">Open Tilawa</p>
        <h1 className="mt-2 font-display text-[40px] leading-tight">المكتبة</h1>
        <p className="mt-1 text-[13px] text-ink-secondary">
          <span className="tnum">{reciters.length}</span> قارئًا · التلاوات كاملة من المصادر
          المفتوحة
        </p>
      </header>

      {resumeReciter && resumeSurah && (
        <Link
          to={`/reciter/${resumeReciter.id}/${resumeSurah.id}`}
          className="mt-7 flex items-center gap-4 rounded-lg border border-divider bg-surface-1 px-4 py-3 transition-colors hover:bg-surface-2/60"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
            <Icon name="play" size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-ink-tertiary">تابع من حيث توقفت</span>
            <span className="block truncate text-[15px] font-semibold">
              {resumeSurah.name}
            </span>
            <span className="block truncate text-[11px] text-ink-secondary">
              {resumeReciter.name}
            </span>
          </span>
          <Icon name="chevron" size={18} className="rotate-180 text-ink-tertiary" />
        </Link>
      )}

      <div className="mt-7">
        <label className="flex items-center gap-2 rounded-md border border-divider px-3 focus-within:border-ink-tertiary">
          <Icon name="search" size={16} className="shrink-0 text-ink-tertiary" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن قارئ"
            className="h-11 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-tertiary"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(['all', ...sources] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSource(value)}
              aria-pressed={source === value}
              className={cn(
                'rounded-pill border px-3 py-1 text-[11px] transition-colors',
                source === value
                  ? 'border-ink bg-ink text-canvas'
                  : 'border-divider text-ink-secondary hover:text-ink',
              )}
            >
              {value === 'all' ? 'الكل' : value}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-4 border-t border-divider">
        {visible.map((reciter) => (
          <li key={reciter.id}>
            <Link
              to={`/reciter/${reciter.id}`}
              className="flex items-center gap-3 border-b border-divider/70 py-3.5 transition-colors hover:bg-surface-1/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px]">{reciter.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-tertiary">
                  <span>{reciter.source}</span>
                  {hasHttpFallback(reciter) && <span>· HTTP</span>}
                </p>
              </div>
              <Fidelity p2p={Boolean(reciter.magnet)} />
              <Icon name="chevron" size={16} className="rotate-180 text-ink-tertiary" />
            </Link>
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="py-12 text-center text-[13px] text-ink-tertiary">لا قارئ بهذا الاسم.</p>
      )}
    </div>
  );
}
