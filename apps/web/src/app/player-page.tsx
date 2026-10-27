import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import PlayerFooter from '@/components/player-footer';
import Scrubber from '@/components/scrubber';
import Sheet, { ReciterSheet, SurahSheet } from '@/components/sheet';
import StreamSheet, { type StreamSource } from '@/components/stream-sheet';
import Transport from '@/components/transport';
import Visualiser from '@/components/visualiser';
import { surahById } from '@/constants/surah';
import { useLocale } from '@/hooks/use-locale';
import { usePlayerNav } from '@/hooks/use-player-nav';
import { getPosition, loadState, saveState, setLastSurah } from '@/hooks/use-persistence';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useReciters } from '@/hooks/use-reciters';
import { useShortcuts } from '@/hooks/use-shortcuts';
import { selectedReciterAtom } from '@/jotai/atom';
import {
  isPlayingAtom,
  mutedAtom,
  positionAtom,
  visualiserAtom,
  rateAtom,
  retrySignalAtom,
  torrentAtom,
  torrentErrorAtom,
} from '@/jotai/player';
import type { Reciter } from '@/types';
import { seekBy } from '@/utils/clamp';
import { surahIdOf } from '@/utils/surah-id';
import { normaliseVisualiser } from '@/utils/visualiser-models';

/**
 * The site is this screen. There is no navigation: the two lists are the only
 * way out of the player, and they close back onto it.
 */
export default function PlayerPage({
  sheet,
  pinned,
  togglePin,
  openSurahs,
  openReciters,
  openStream,
  openKeys,
  close,
  onOpenMenu,
}: {
  sheet: 'surahs' | 'reciters' | 'stream' | 'keys' | null;
  pinned: boolean;
  togglePin: () => void;
  openSurahs: () => void;
  openReciters: () => void;
  openStream: () => void;
  openKeys: () => void;
  close: () => void;
  onOpenMenu: () => void;
}) {
  const { t } = useLocale();
  const { reciters, error: recitersError, retry: retryReciters } = useReciters();
  const wide = useMediaQuery('(min-width: 1024px)');
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const keyboard = wide && finePointer;

  const [reciter, setReciter] = useAtom(selectedReciterAtom);
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom);
  const [error] = useAtom(torrentErrorAtom);
  const setRetrySignal = useSetAtom(retrySignalAtom);

  const position = useAtomValue(positionAtom);
  const [rate, setRate] = useAtom(rateAtom);
  const [muted, setMuted] = useAtom(mutedAtom);
  const [visualiser, setVisualiser] = useAtom(visualiserAtom);
  const torrent = useAtomValue(torrentAtom);
  const { surahId, duration, ready, track, selectSurah, playSurah, seekTo, next, previous } =
    usePlayerNav();

  /** Put the listener back where they stopped: their reciter, their surah. */
  const restoreFor = useCallback(
    (target: Reciter) => {
      const state = loadState();
      const saved = getPosition(target.id);
      // A surah picked but never played still counts as "where they were".
      const surahId =
        saved?.surahId ?? (state.reciterId === target.id ? state.lastSurahId : undefined) ?? 1;
      selectSurah(surahId, target.id);
    },
    [selectSurah],
  );

  const booted = useRef(false);
  useEffect(() => {
    if (booted.current || reciters.length === 0) return;
    booted.current = true;

    const stored = loadState();
    const saved = reciters.find((candidate) => candidate.id === stored.reciterId) ?? reciters[0];
    setReciter(saved);
    setRate(stored.settings.rate ?? 1);
    setVisualiser(normaliseVisualiser(stored.settings.visualiser));
    restoreFor(saved);
  }, [reciters, restoreFor, setReciter]);

  const pickReciter = (picked: Reciter) => {
    setReciter(picked);
    saveState({ ...loadState(), reciterId: picked.id });
    setIsPlaying(false);
    restoreFor(picked);
    if (!pinned) close();
  };

  const pickSurah = (picked: number) => {
    playSurah(picked);
    if (!pinned) close();
  };

  const surah = surahById(surahId);

  /**
   * Keyboard is a desktop affordance: wide layout *and* a real pointer. A phone
   * with a Bluetooth keyboard keeps its media keys and nothing else.
   */
  const [hint, setHint] = useState(false);
  useEffect(() => {
    if (!keyboard) return;
    try {
      if (!window.localStorage.getItem('tilawa.keys.v1')) setHint(true);
    } catch {
      // A blocked store means the hint shows again; harmless.
    }
  }, [keyboard]);

  const dismissHint = useCallback(() => {
    setHint(false);
    try {
      window.localStorage.setItem('tilawa.keys.v1', '1');
    } catch {
      // ignore
    }
  }, []);

  useShortcuts(keyboard, {
    onPlayPause: () => setIsPlaying((value) => !value),
    onBack: () => seekTo(seekBy(position, -15, duration)),
    onForward: () => seekTo(seekBy(position, 15, duration)),
    onPrevious: previous,
    onNext: next,
    onReciters: openReciters,
    onSurahs: openSurahs,
    onMute: () => setMuted((value) => !value),
    onHelp: () => {
      openKeys();
      dismissHint();
    },
    onClose: close,
    onAny: dismissHint,
  });

  /** Bytes per surah, once the torrent knows its files. */
  const sizes = useMemo(() => {
    const map: Record<number, number> = {};
    torrent?.files.forEach((file, index) => {
      const bytes = (file.file as { length?: number } | undefined)?.length;
      if (typeof bytes === 'number' && bytes > 0) map[surahIdOf(file, index)] = bytes;
    });
    return map;
  }, [torrent]);

  /**
   * The ring is about *this surah*, not the release: the whole reciter is ~700MB
   * and 0.2% of it would look empty for a while. WebTorrent keeps a per-file
   * progress on the file object itself, which is exactly the number a listener
   * wants ("how much of what I am hearing is here").
   */
  const currentFile = track?.file as { progress?: number } | undefined;
  const progress =
    typeof currentFile?.progress === 'number' ? currentFile.progress : (torrent?.progress ?? 0);

  const source: StreamSource =
    torrent?.webSeed === 'active'
      ? 'webseed'
      : (torrent?.peers ?? 0) > 0
        ? 'connected'
        : 'waiting';

  return (
    <>
      <main className="player-screen theatre">
        <div className="w-full max-w-[520px]">
          {/* The name lives in the footer and in the accessible heading; the
              space above the scrubber belongs to what the speaker is doing. */}
          <h1 className="sr-only lg:not-sr-only lg:fixed lg:inset-x-0 lg:top-[22vh] lg:text-center lg:text-[clamp(32px,4vw,56px)] lg:font-semibold lg:tracking-[-0.02em] lg:text-ink">
            {wide ? (
              <button
                type="button"
                onClick={openSurahs}
                aria-haspopup="dialog"
                className="group inline-flex items-baseline gap-3"
              >
                {surah?.name ?? `سورة ${surahId}`}
                <span
                  aria-hidden="true"
                  className="text-[18px] text-muted opacity-30 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  ▾
                </span>
              </button>
            ) : (
              surah?.name ?? `سورة ${surahId}`
            )}
          </h1>
          <p className="hidden lg:fixed lg:inset-x-0 lg:top-[calc(22vh+72px)] lg:block lg:text-center lg:text-[16px] lg:text-muted">
            <button
              type="button"
              onClick={openReciters}
              aria-haspopup="dialog"
              className="group inline-flex items-center gap-2 hover:text-ink"
            >
              {reciter?.name ?? ''}
              <span
                aria-hidden="true"
                className="text-[13px] opacity-30 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                ▾
              </span>
            </button>
          </p>
          <div className="theatre-horizon flex justify-center lg:fixed lg:inset-x-0 lg:bottom-0 lg:z-0 lg:opacity-70">
            <Visualiser playing={isPlaying} model={visualiser} height={wide ? 160 : 64} />
          </div>
          {/* The floor: the horizon's edge, kept even when paused so the stage
              never becomes a blank page. */}
          <div
            aria-hidden="true"
            className="theatre-floor hidden lg:fixed lg:inset-x-0 lg:bottom-[160px] lg:z-0 lg:block lg:h-px lg:bg-line"
          />

          <div className="mt-10 lg:mx-auto lg:mt-0 lg:w-[560px]">
            <Scrubber
              position={position}
              duration={duration}
              onSeek={(seconds) => {
                if (duration > 0) seekTo(seconds);
              }}
            />
          </div>

          <Transport
            className="mt-4"
            canPlay={ready}
            isPlaying={isPlaying}
            onPlayPause={() => setIsPlaying(!isPlaying)}
            onPrevious={previous}
            onNext={next}
            onSeekDelta={(delta) => {
              if (duration > 0) seekTo(seekBy(position, delta, duration));
            }}
          />

          {reciters.length === 0 ? (
            <div className="mt-6 text-center text-[13px] text-muted">
              <p>{recitersError ? t.sheets.recitersError : t.player.noReciters}</p>
              <button
                type="button"
                onClick={retryReciters}
                className="mt-1 h-11 px-3 font-semibold text-ink underline underline-offset-4"
              >
                {t.player.retry}
              </button>
            </div>
          ) : error ? (
            <div className="mt-6 text-center text-[13px] text-muted">
              <p title={error}>{t.player.error}</p>
              <button
                type="button"
                onClick={() => setRetrySignal((count) => count + 1)}
                className="mt-1 h-11 px-3 font-semibold text-ink underline underline-offset-4"
              >
                {t.player.retry}
              </button>
            </div>
          ) : null}

          {hint && keyboard ? (
            <p className="mt-6 text-center text-[11.5px] text-muted lg:fixed lg:inset-x-0 lg:bottom-[236px] lg:mt-0">
              {t.keys.hint}
              <button
                type="button"
                onClick={dismissHint}
                className="ms-2 underline underline-offset-4 hover:text-ink"
              >
                {t.keys.dismiss}
              </button>
            </p>
          ) : null}
        </div>
      </main>

      <PlayerFooter
        surahName={surah?.name ?? `سورة ${surahId}`}
        reciterName={reciter?.name ?? 'اختر قارئاً'}
        source={source}
        onOpenSurahs={openSurahs}
        onOpenReciters={openReciters}
        onOpenStream={openStream}
        rate={rate}
        onOpenRate={onOpenMenu}
        muted={muted}
        onToggleMute={() => setMuted((value) => !value)}
      />

      <StreamSheet open={sheet === 'stream'} onClose={close} source={source} torrent={torrent} surahId={surahId} />

      <SurahSheet
        open={sheet === 'surahs'}
        onClose={close}
        current={surahId}
        sizes={sizes}
        onPick={pickSurah}
        pinned={pinned}
        onTogglePin={wide ? togglePin : undefined}
      />

      <ReciterSheet
        open={sheet === 'reciters'}
        onClose={close}
        reciters={reciters}
        current={reciter?.id}
        onPick={pickReciter}
        error={recitersError}
        onRetry={retryReciters}
        pinned={pinned}
        onTogglePin={wide ? togglePin : undefined}
      />

      <Sheet title={t.keys.title} open={sheet === 'keys'} onClose={close} size="auto" pinned={pinned} onTogglePin={wide ? togglePin : undefined}>
        <dl className="space-y-3 px-5 py-4">
          {[
            { key: 'Space', value: t.keys.playPause },
            { key: '← / →', value: t.keys.seek },
            { key: '↑ / ↓', value: t.keys.surahs },
            { key: 'R', value: t.keys.reciters },
            { key: 'S', value: t.keys.surahList },
            { key: 'M', value: t.keys.mute },
            { key: '?', value: t.keys.help },
            { key: 'Esc', value: t.keys.close },
          ].map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-6">
              <dt className="text-[13px] text-muted">{row.value}</dt>
              <dd className="rounded-md border border-line px-2 py-0.5 font-mono text-[11.5px] text-ink">
                {row.key}
              </dd>
            </div>
          ))}
        </dl>
      </Sheet>
    </>
  );
}
