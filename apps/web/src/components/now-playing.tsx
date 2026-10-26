import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Icon } from '@/components/icons';
import { Fidelity } from '@/components/player-bits';
import Scrubber from '@/components/scrubber';
import { surahById } from '@/constants/surah';
import { usePlayerNav } from '@/hooks/use-player-nav';
import { selectedReciterAtom } from '@/jotai/atom';
import {
  bufferedAtom,
  durationAtom,
  isPlayingAtom,
  positionAtom,
  queueOpenAtom,
  rateAtom,
  repeatAtom,
  torrentAtom,
  torrentErrorAtom,
} from '@/jotai/player';
import { cn } from '@/utils/cn';
import { formatBytes } from '@/utils/format-bytes';
import { audioRef } from '@/utils/audio-ref';

const SPEEDS = [0.75, 1, 1.25];

type Props = {
  surahId: number;
  /** Mobile renders this as a full page; desktop as the centre column. */
  className?: string;
};

/**
 * The desk. One surah name, set like a title page, and four controls that mean
 * exactly what they say. Everything secondary is folded into the overflow menu
 * so the middle of the screen stays quiet.
 */
export default function NowPlaying({ surahId, className }: Props) {
  const reciter = useAtomValue(selectedReciterAtom);
  const torrent = useAtomValue(torrentAtom);
  const error = useAtomValue(torrentErrorAtom);
  const isPlaying = useAtomValue(isPlayingAtom);
  const setIsPlaying = useSetAtom(isPlayingAtom);
  const position = useAtomValue(positionAtom);
  const duration = useAtomValue(durationAtom);
  const buffered = useAtomValue(bufferedAtom);
  const [repeat, setRepeat] = useAtom(repeatAtom);
  const [rate, setRate] = useAtom(rateAtom);
  const setPosition = useSetAtom(positionAtom);
  const setQueueOpen = useSetAtom(queueOpenAtom);
  const { next, previous, files, playIndex } = usePlayerNav();

  const [menuOpen, setMenuOpen] = useState(false);
  const surah = surahById(surahId);
  const at = files.findIndex((track, i) => (track.surahId > 0 ? track.surahId : i + 1) === surahId);
  const track = at >= 0 ? files[at] : undefined;
  const size = (track?.file as { length?: number } | undefined)?.length ?? null;
  const ready = Boolean(track);

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setPosition(seconds);
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [surahId]);

  return (
    <div
      className={cn(
        'flex min-h-full flex-col px-5 pb-8 pt-4 sm:px-8 lg:justify-center lg:px-12 lg:py-14',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center lg:flex-none">
        {/* Mobile: a quiet way back to the reciter, not a title bar. */}
        <div className="mb-6 flex items-center justify-between lg:hidden">
          <Link
            to={reciter ? `/reciter/${reciter.id}` : '/'}
            aria-label="رجوع"
            className="-ms-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary"
          >
            <Icon name="chevron" size={22} className="rotate-180" />
          </Link>
          <Fidelity p2p={Boolean(reciter?.magnet)} />
          <button
            type="button"
            onClick={() => setQueueOpen(true)}
            aria-label="قائمة التشغيل"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink"
          >
            <Icon name="queue" size={22} />
          </button>
        </div>

        <div className="hidden items-center justify-between lg:flex">
          <Link
            to={reciter ? `/reciter/${reciter.id}` : '/'}
            className="text-[13px] text-ink-secondary transition-colors hover:text-ink"
          >
            {reciter?.name ?? 'اختر قارئًا'}
          </Link>
          <Fidelity p2p={Boolean(reciter?.magnet)} />
        </div>

        <div className="mt-8 lg:mt-12">
          <p className="text-[11px] font-semibold tracking-normal text-ink-tertiary">
            سورة
          </p>
          <h1 className="mt-1 font-display text-[clamp(3.25rem,11vw,6rem)] leading-[1.35] text-ink">
            {surah?.name ?? `سورة ${surahId}`}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-secondary">
            <span className="tnum">
              {surah ? `الجزء ${surah.juz} · ${surah.ayahCount} آية` : '—'}
            </span>
            {size && <span className="tnum">{formatBytes(size)}</span>}
          </p>
        </div>

        <div className="mt-10 lg:mt-14">
          <Scrubber position={position} duration={duration} buffered={buffered} onSeek={seek} />

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setRepeat((value) => (value === 'one' ? 'off' : 'one'))}
              aria-pressed={repeat === 'one'}
              title={repeat === 'one' ? 'تكرار السورة: مفعّل' : 'تكرار السورة: متوقف'}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                repeat === 'one' ? 'text-accent' : 'text-ink-secondary hover:text-ink',
              )}
            >
              <Icon name={repeat === 'one' ? 'repeatOne' : 'repeat'} size={20} />
            </button>

            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={previous}
                aria-label="السورة السابقة"
                className="flex h-12 w-12 items-center justify-center rounded-full text-ink transition-transform active:scale-95"
              >
                <Icon name="previous" size={26} />
              </button>

              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                disabled={!ready}
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-full bg-ink text-canvas transition-transform',
                  'active:scale-95 disabled:opacity-40',
                )}
              >
                <Icon name={isPlaying ? 'pause' : 'play'} size={26} />
              </button>

              <button
                type="button"
                onClick={next}
                aria-label="السورة التالية"
                className="flex h-12 w-12 items-center justify-center rounded-full text-ink transition-transform active:scale-95"
              >
                <Icon name="next" size={26} />
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-label="خيارات"
                className="flex h-11 w-11 items-center justify-center rounded-full text-ink-secondary transition-colors hover:text-ink"
              >
                <Icon name="more" size={22} />
              </button>

              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-hidden="true"
                    tabIndex={-1}
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-10 cursor-default"
                  />
                  <div className="absolute bottom-12 end-0 z-20 w-44 rounded-md border border-divider bg-surface-1 p-1.5 text-start">
                    <p className="px-2 py-1 text-[11px] text-ink-tertiary">السرعة</p>
                    {SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => {
                          setRate(speed);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-surface-2"
                      >
                        <span className="tnum">{speed}×</span>
                        {rate === speed && <Icon name="check" size={15} className="text-accent" />}
                      </button>
                    ))}
                    {track?.link && (
                      <>
                        <div className="my-1 border-t border-divider" />
                        <a
                          href={track.link}
                          download
                          className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-surface-2"
                        >
                          <Icon name="download" size={15} />
                          تنزيل السورة
                        </a>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 flex min-h-[18px] items-center justify-center gap-2 text-[11px] text-ink-tertiary">
            {error ? (
              <span className="text-error">{error}</span>
            ) : torrent && !ready ? (
              <span>جارٍ تحضير الملف…</span>
            ) : ready ? (
              <span className="tnum flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                {torrent?.peers ?? 0} قرين
                <span aria-hidden="true">·</span>
                {((torrent?.downloadSpeed ?? 0) / 1024).toFixed(0)} ك.ب/ث
              </span>
            ) : (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-tertiary" />
            )}
          </div>

          <div className="mt-6 flex justify-center lg:hidden">
            <button
              type="button"
              onClick={() => setQueueOpen(true)}
              className="rounded-pill border border-divider px-5 py-2 text-[13px] text-ink-secondary"
            >
              قائمة التشغيل
            </button>
          </div>
        </div>
      </div>

      {/* The play-all affordance for a reciter whose torrent is still arriving. */}
      {!ready && files.length > 0 && (
        <button
          type="button"
          onClick={() => playIndex(0)}
          className="mx-auto mt-8 rounded-pill bg-ink px-5 py-2 text-sm font-semibold text-canvas"
        >
          تشغيل من البداية
        </button>
      )}
    </div>
  );
}
