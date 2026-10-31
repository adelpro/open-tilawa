import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import PlayerFooter from '@/components/player-footer';
import Icon from '@/components/icons';
import Scrubber from '@/components/scrubber';
import Sheet, { ReciterSheet, SurahSheet, type ReciterScope } from '@/components/sheet';
import StreamSheet from '@/components/stream-sheet';
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
import type { Parsed } from '@/routes';
import { seekBy } from '@/utils/clamp';
import { cn } from '@/utils/cn';
import type { StreamSource } from '@/utils/stream-source';
import { streamSourceFor } from '@/utils/stream-source';
import { surahIdOf } from '@/utils/surah-id';
import { bootSelection } from '@/utils/boot-selection';
import { normaliseVisualiser } from '@/utils/visualiser-models';
import { riwayaLabel } from '@/utils/riwaya';

/** Set once the one-time shortcut hint has been dismissed. */
const KEYS_HINT_KEY = 'tilawa.keys.v1';

/**
 * Read the hint's state before the first paint. Resolving it in an effect made
 * the line appear after mount, which is harmless while it is floating but a
 * jump once it holds a row in the layout.
 */
function wantsKeyboardHint(enabled: boolean): boolean {
  if (!enabled) return false;
  try {
    return !window.localStorage.getItem(KEYS_HINT_KEY);
  } catch {
    // A store we cannot read is a store we cannot promise to remember.
    return false;
  }
}

/**
 * The site is this screen. There is no navigation: the two lists are the only
 * way out of the player, and they close back onto it.
 */
export default function PlayerPage({
  sheet,
  pinned,
  togglePin,
  reciterScope,
  openSurahs,
  openReciters,
  openStream,
  openKeys,
  close,
  onOpenMenu,
  route,
}: {
  sheet: 'surahs' | 'reciters' | 'stream' | 'keys' | null;
  pinned: boolean;
  togglePin: () => void;
  reciterScope: ReciterScope;
  openSurahs: () => void;
  openReciters: () => void;
  openStream: () => void;
  openKeys: () => void;
  close: () => void;
  onOpenMenu: () => void;
  /** What the address says, so boot knows whether it is allowed to restore anything. */
  route: Parsed;
}) {
  const { t } = useLocale();
  const {
    reciters,
    error: recitersError,
    retry: retryReciters,
    loadMore: loadMoreReciters,
    loading: loadingReciters,
    hasMore: hasMoreReciters,
  } = useReciters();
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
    setRate(stored.settings.rate ?? 1);
    setVisualiser(normaliseVisualiser(stored.settings.visualiser));

    // The address wins when it names a recitation: on `/listen/...` this returns null,
    // because restoring "where they stopped" is what used to overwrite the surah the
    // link asked for. Settings still come back; the selection does not.
    const choice = bootSelection({
      route,
      reciters,
      storedReciterId: stored.reciterId,
      storedSurahId: stored.lastSurahId,
      savedPositionFor: getPosition,
    });
    if (!choice) return;

    setReciter(choice.reciter);
    selectSurah(choice.surahId, choice.reciter.id);
  }, [route, reciters, selectSurah, setReciter]);

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
   * `unknown` is the catalogue saying it does not know. Printing that as a
   * reading would assert a riwaya on a recording nobody classified. The name is
   * the name: the reading lives in its own column and is printed here, once.
   */
  const riwayaCode = reciter?.riwaya?.trim();
  const riwaya =
    riwayaCode && riwayaCode.toLowerCase() !== 'unknown' ? riwayaLabel(riwayaCode) : null;

  /** The title's chevrons are toggles: the arrow that opened a panel closes it. */
  const surahsOpen = sheet === 'surahs';
  const recitersOpen = sheet === 'reciters';

  /**
   * Keyboard is a desktop affordance: wide layout *and* a real pointer. A phone
   * with a Bluetooth keyboard keeps its media keys and nothing else.
   */
  const [hint, setHint] = useState(() => wantsKeyboardHint(keyboard));

  // The initial read covers the first paint; this covers a resize into or out
  // of the wide layout. A dismissed hint stays dismissed.
  useEffect(() => {
    setHint(wantsKeyboardHint(keyboard));
  }, [keyboard]);

  const dismissHint = useCallback(() => {
    setHint(false);
    try {
      window.localStorage.setItem(KEYS_HINT_KEY, '1');
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

  /**
   * What is feeding the stream *now*. The web seed is never removed once added,
   * so "webseed" alone stopped being the truth the moment a peer connected:
   * both sources run concurrently, and the label has to say so.
   */
  const source: StreamSource = streamSourceFor({
    webSeed: torrent?.webSeed,
    peers: torrent?.peers ?? 0,
  });

  return (
    <>
      <main className="player-screen theatre">
        <div className="w-full max-w-[520px]">
          {/* The colophon: the name, the recording it is heard in, and the
              surah's own facts underneath. One fixed block, so the docked panel
              only has one thing to move (`.theatre-title`). On a phone the
              footer carries the names and this whole block stays out of the
              way. */}
          <div className="theatre-title lg:fixed lg:inset-x-0 lg:top-[18vh] lg:flex lg:flex-col lg:items-center lg:text-center">
            <h1 className="sr-only lg:not-sr-only lg:text-[clamp(32px,3.4vw,52px)] lg:font-semibold lg:leading-[1.3] lg:tracking-normal lg:text-ink">
              {wide ? (
                <button
                  type="button"
                  onClick={() => (surahsOpen ? close() : openSurahs())}
                  aria-haspopup="dialog"
                  aria-expanded={surahsOpen}
                  className="group inline-flex items-center gap-3 rounded-md"
                >
                  {/* A spacer the size of the icon keeps the name itself on the
                      centre line; the chevron grows into it on hover without
                      moving what the eye is reading. */}
                  <span aria-hidden="true" className="w-5 shrink-0" />
                  <span className="underline-offset-[6px] group-hover:underline group-focus-visible:underline">
                    {surah?.name ?? `سورة ${surahId}`}
                  </span>
                  <Icon
                    name="expand"
                    size={20}
                    className={cn(
                      'w-5 shrink-0 text-muted transition-[opacity,transform] group-hover:opacity-100 group-focus-visible:opacity-100',
                      surahsOpen ? 'rotate-180 opacity-100' : 'opacity-45',
                    )}
                  />
                </button>
              ) : (
                surah?.name ?? `سورة ${surahId}`
              )}
            </h1>

            {/* The reciter is a control, not a caption: the pill reads as one at
                rest, and the riwaya rides along when the catalogue knows it.
                With no roster there is no pill to open — not an empty one. */}
            {reciter ? (
              <p className="hidden lg:mt-4 lg:flex lg:justify-center">
                <button
                  type="button"
                  onClick={() => (recitersOpen ? close() : openReciters())}
                  aria-haspopup="dialog"
                  aria-expanded={recitersOpen}
                  className="group flex min-h-9 max-w-[520px] items-center gap-2 rounded-full px-3 text-[1rem] text-muted transition-colors hover:bg-line hover:text-ink focus-visible:bg-line focus-visible:text-ink"
                >
                  <Icon name="mic" className="shrink-0" />
                  <span className="min-w-0 truncate">
                    {reciter.name}
                    {riwaya ? ` · ${riwaya}` : ''}
                  </span>
                  <Icon
                    name="expand"
                    size={16}
                    className={cn(
                      'shrink-0 transition-[opacity,transform] group-hover:opacity-100 group-focus-visible:opacity-100',
                      recitersOpen ? 'rotate-180 opacity-100' : 'opacity-0',
                    )}
                  />
                </button>
              </p>
            ) : null}

            {/* The surah's number belongs to its facts, not to the title: one
                line, one type size, the seal reduced to match. */}
            <p className="mt-2 hidden items-center justify-center gap-2 text-[0.75rem] text-muted tnum lg:flex">
              <span
                aria-hidden="true"
                className="flex h-5 w-5 items-center justify-center rounded-full border border-line"
              >
                {surahId}
              </span>
              {surah ? (
                <span>{`${t.sheets.verses(surah.ayahCount)} · ${t.sheets.juz(surah.juz)}`}</span>
              ) : null}
            </p>
          </div>
          <div className="theatre-horizon mb-4 flex justify-center">
            <Visualiser playing={isPlaying} model={visualiser} height={wide ? 160 : 96} />
          </div>

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
            <div className="mt-6 text-center text-[0.875rem] text-muted">
              <p>{recitersError ? t.sheets.recitersError : t.player.noReciters}</p>
              <button
                type="button"
                onClick={retryReciters}
                className="mt-1 min-h-11 px-3 font-semibold text-ink underline underline-offset-4"
              >
                {t.player.retry}
              </button>
            </div>
          ) : error ? (
            <div className="mt-6 text-center text-[0.875rem] text-muted">
              <p title={error}>{t.player.error}</p>
              <button
                type="button"
                onClick={() => setRetrySignal((count) => count + 1)}
                className="mt-1 min-h-11 px-3 font-semibold text-ink underline underline-offset-4"
              >
                {t.player.retry}
              </button>
            </div>
          ) : null}

          {hint && keyboard ? (
            <p className="mt-6 text-center text-[0.75rem] text-muted lg:mt-4">
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
        progress={progress}
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
        initialScope={reciterScope}
        error={recitersError}
        onRetry={retryReciters}
        pinned={pinned}
        onTogglePin={wide ? togglePin : undefined}
        onLoadMore={loadMoreReciters}
        loading={loadingReciters}
        hasMore={hasMoreReciters}
      />

      <Sheet title={t.keys.title} open={sheet === 'keys'} onClose={close} size="auto" pinned={pinned} onTogglePin={wide ? togglePin : undefined}>
        <dl className="space-y-3 px-4 py-4">
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
              <dt className="text-[0.875rem] text-muted">{row.value}</dt>
              <dd className="rounded-md border border-line px-2 py-1 font-mono text-[0.75rem] text-ink">
                {row.key}
              </dd>
            </div>
          ))}
        </dl>
      </Sheet>
    </>
  );
}
