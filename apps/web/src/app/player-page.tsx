import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import BottomBar from '@/components/bottom-bar';
import type { StreamSource } from '@/components/details-popover';
import { AboutSheet, MenuSheet, PrivacySheet } from '@/components/menu-sheet';
import Scrubber from '@/components/scrubber';
import Sheet, { ReciterSheet, SurahSheet } from '@/components/sheet';
import TopBar from '@/components/top-bar';
import Transport from '@/components/transport';
import { surahById } from '@/constants/surah';
import { usePlayerNav } from '@/hooks/use-player-nav';
import { getPosition, loadState, saveState } from '@/hooks/use-persistence';
import { useReciters } from '@/hooks/use-reciters';
import { useSheet } from '@/hooks/use-sheet';
import { useTheme } from '@/hooks/use-theme';
import { selectedReciterAtom } from '@/jotai/atom';
import {
  isPlayingAtom,
  positionAtom,
  rateAtom,
  retrySignalAtom,
  torrentAtom,
  torrentErrorAtom,
} from '@/jotai/player';
import type { Reciter } from '@/types';
import { seekBy } from '@/utils/clamp';
import { surahIdOf } from '@/utils/surah-id';

/**
 * The site is this screen. Three edges and nothing else: a bar for the brand
 * and the menu, the player itself, a bar for the list and the stream status.
 */
export default function PlayerPage() {
  const { reciters } = useReciters();
  const { sheet, open, close } = useSheet();
  const { theme, setTheme } = useTheme();

  const [reciter, setReciter] = useAtom(selectedReciterAtom);
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom);
  const [error] = useAtom(torrentErrorAtom);
  const setRetrySignal = useSetAtom(retrySignalAtom);
  const setRate = useSetAtom(rateAtom);

  const position = useAtomValue(positionAtom);
  const torrent = useAtomValue(torrentAtom);
  const { surahId, duration, rate, ready, selectSurah, playSurah, seekTo, cycleRate, next, previous } =
    usePlayerNav();

  const [detailsOpen, setDetailsOpen] = useState(false);

  /** Put the listener back where they stopped: their reciter, their surah. */
  const restoreFor = useCallback(
    (target: Reciter) => {
      const saved = getPosition(target.id);
      selectSurah(saved?.surahId ?? 1, target.id);
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
    setRate(stored.rate ?? 1);
    restoreFor(saved);
  }, [reciters, restoreFor, setReciter, setRate]);

  const pickReciter = (picked: Reciter) => {
    setReciter(picked);
    saveState({ ...loadState(), reciterId: picked.id });
    setIsPlaying(false);
    restoreFor(picked);
    close();
  };

  const pickSurah = (picked: number) => {
    playSurah(picked);
    close();
  };

  const openSheet = (kind: Parameters<typeof open>[0]) => {
    setDetailsOpen(false);
    open(kind);
  };

  const surah = surahById(surahId);

  /** File sizes for the list, once the torrent's metadata has landed. */
  const sizes = useMemo(() => {
    const map: Record<number, number> = {};
    torrent?.files.forEach((file, index) => {
      const bytes = (file.file as { length?: number } | undefined)?.length;
      if (typeof bytes === 'number' && bytes > 0) map[surahIdOf(file, index)] = bytes;
    });
    return map;
  }, [torrent]);

  const source: StreamSource = reciter && !reciter.magnet ? 'http' : (torrent?.peers ?? 0) > 0 ? 'connected' : 'waiting';

  return (
    <div className="app-shell">
      <TopBar onOpenMenu={() => openSheet('menu')} />

      <main className="player-screen">
        <div className="w-full max-w-[520px]">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => openSheet('reciters')}
              aria-label="اختيار القارئ"
              className="flex h-11 items-center rounded-full border border-line bg-line px-4 text-[15px] text-ink transition-colors hover:border-ink/30 active:opacity-80"
            >
              {reciter?.name ?? 'اختر قارئاً'}
            </button>
          </div>

          <h1 className="font-display mt-3 text-center text-[52px] leading-[1.3] text-ink">
            {surah?.name ?? `سورة ${surahId}`}
          </h1>
          <p className="tnum mt-1 text-center text-[13px] text-muted">سورة {surahId} من 114</p>

          <div className="mt-10">
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

          {error && (
            <div className="mt-6 text-center text-[13px] text-muted">
              <p title={error}>تعذّر تشغيل هذا القارئ.</p>
              <button
                type="button"
                onClick={() => setRetrySignal((count) => count + 1)}
                className="mt-1 h-11 px-3 font-semibold text-ink underline underline-offset-4"
              >
                إعادة المحاولة
              </button>
            </div>
          )}
        </div>
      </main>

      <BottomBar
        surahName={surah?.name ?? `سورة ${surahId}`}
        rate={rate}
        source={source}
        torrent={torrent}
        detailsOpen={detailsOpen}
        onOpenList={() => openSheet('surahs')}
        onCycleRate={cycleRate}
        onToggleDetails={() => setDetailsOpen((isOpen) => !isOpen)}
        onCloseDetails={() => setDetailsOpen(false)}
      />

      <Sheet title="السور" open={sheet === 'surahs'} onClose={close}>
        <SurahSheet open={sheet === 'surahs'} current={surahId} sizes={sizes} onPick={pickSurah} />
      </Sheet>

      <Sheet title="القرّاء" open={sheet === 'reciters'} onClose={close}>
        <ReciterSheet reciters={reciters} current={reciter?.id} onPick={pickReciter} />
      </Sheet>

      <MenuSheet
        open={sheet === 'menu'}
        onClose={close}
        theme={theme}
        onTheme={setTheme}
        onOpenAbout={() => open('about')}
        onOpenPrivacy={() => open('privacy')}
      />
      <AboutSheet open={sheet === 'about'} onClose={close} />
      <PrivacySheet open={sheet === 'privacy'} onClose={close} />
    </div>
  );
}
