import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Icon from '@/components/icons';
import PlayerFooter from '@/components/player-footer';
import Scrubber from '@/components/scrubber';
import Sheet, { ReciterSheet, SurahSheet, type ReciterScope } from '@/components/sheet';
import StreamSheet from '@/components/stream-sheet';
import Transport from '@/components/transport';
import Visualiser from '@/components/visualiser';
import { surahById } from '@/constants/surah';
import { useLocale } from '@/hooks/use-locale';
import { usePlayerNav } from '@/hooks/use-player-nav';
import { getPosition, loadState, saveState } from '@/hooks/use-persistence';
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
import { audioRef } from '@/utils/audio-ref';
import { cn } from '@/utils/cn';
import type { StreamSource } from '@/utils/stream-source';
import { streamSourceFor } from '@/utils/stream-source';
import { surahIdOf } from '@/utils/surah-id';
import { bootSelection } from '@/utils/boot-selection';
import { normaliseVisualiser } from '@/utils/visualiser-models';
import { riwayaLabel } from '@/utils/riwaya';
import { reciterName } from '@/utils/reciter-name';
import { surahName } from '@/utils/surah-name';

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
 * The site is this screen. The surah being read is the title, the recitation is
 * the instrument, and the two lists beside it are the history of where the
 * listener stopped and who else can read to them.
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
  const { t, locale } = useLocale();
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
    // Stop the old element before the atoms move: its clock is the outgoing
    // reciter's, and a timeupdate that lands after the switch would write those
    // seconds under the incoming one.
    audioRef.current?.pause();
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
      <main className="desk">
        <div className="desk-grid">
          {/* The recitation: the name, who is reading it, where it sits in the
              mushaf, and the instrument that plays it. */}
          <section className="now" aria-labelledby="now-title">
            <div className="now-head">
              <div className="now-heading">
                <h1 id="now-title" className="now-title">
                  <button
                    type="button"
                    onClick={() => (surahsOpen ? close() : openSurahs())}
                    aria-haspopup="dialog"
                    aria-expanded={surahsOpen}
                    className="now-title-btn"
                  >
                    <span>{surah ? surahName(surah.id, locale) : t.player.surah(surahId)}</span>
                    <Icon
                      name="expand"
                      size={20}
                      className={cn('now-caret', surahsOpen && 'is-open')}
                    />
                  </button>
                </h1>

                {reciter ? (
                  <button
                    type="button"
                    onClick={() => (recitersOpen ? close() : openReciters())}
                    aria-haspopup="dialog"
                    aria-expanded={recitersOpen}
                    className="now-reciter"
                  >
                    <Icon name="mic" size={16} className="shrink-0" />
                    <span className="min-w-0 truncate">
                      {reciterName(reciter, locale)}
                      {riwaya ? ` · ${riwaya}` : ''}
                    </span>
                    <Icon
                      name="expand"
                      size={16}
                      className={cn('now-caret now-caret--small', recitersOpen && 'is-open')}
                    />
                  </button>
                ) : null}

                {surah ? (
                  <p className="now-facts tnum">
                    {`${t.sheets.verses(surah.ayahCount)} · ${t.sheets.juz(surah.juz)} · ${t.home.page(surah.page)}`}
                  </p>
                ) : null}
              </div>
            </div>

            {/* The spectrum is the instrument's face: it sits directly on the
                timeline, so a quiet band is a rest, never a hole. */}
            <div className="now-wave">
              <Visualiser playing={isPlaying} model={visualiser} height={wide ? 96 : 64} />
            </div>

            <Scrubber
              position={position}
              duration={duration}
              onSeek={(seconds) => {
                if (duration > 0) seekTo(seconds);
              }}
            />

            <div className="now-controls">
              <Transport
                canPlay={ready}
                isPlaying={isPlaying}
                onPlayPause={() => setIsPlaying(!isPlaying)}
                onPrevious={previous}
                onNext={next}
                onSeekDelta={(delta) => {
                  if (duration > 0) seekTo(seekBy(position, delta, duration));
                }}
              />
            </div>

            {reciters.length === 0 ? (
              <div className="now-note">
                <p>{recitersError ? t.sheets.recitersError : t.player.noReciters}</p>
                <button type="button" onClick={retryReciters} className="now-note-action">
                  {t.player.retry}
                </button>
              </div>
            ) : error ? (
              <div className="now-note">
                <p title={error}>{t.player.error}</p>
                <button
                  type="button"
                  onClick={() => setRetrySignal((count) => count + 1)}
                  className="now-note-action"
                >
                  {t.player.retry}
                </button>
              </div>
            ) : null}

            {hint && keyboard ? (
              <p className="now-hint">
                {t.keys.hint}
                <button type="button" onClick={dismissHint} className="now-hint-action">
                  {t.keys.dismiss}
                </button>
              </p>
            ) : null}
          </section>
        </div>
      </main>

      <PlayerFooter
        surahName={surah ? surahName(surah.id, locale) : t.player.surah(surahId)}
        reciterName={reciter ? reciterName(reciter, locale) : 'اختر قارئاً'}
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
              <dd className="rounded-md border border-line px-2 py-1 text-[0.8125rem] text-ink">
                {row.key}
              </dd>
            </div>
          ))}
        </dl>
      </Sheet>
    </>
  );
}
