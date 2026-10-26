import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';

import Scrubber from '@/components/scrubber';
import Sheet, { ReciterSheet, SurahSheet } from '@/components/sheet';
import Transport from '@/components/transport';
import { surahById } from '@/constants/surah';
import { usePlayerNav } from '@/hooks/use-player-nav';
import { getPosition, loadState, saveState } from '@/hooks/use-persistence';
import { useReciters } from '@/hooks/use-reciters';
import { useSheet } from '@/hooks/use-sheet';
import { selectedReciterAtom } from '@/jotai/atom';
import {
  isPlayingAtom,
  positionAtom,
  retrySignalAtom,
  torrentErrorAtom,
} from '@/jotai/player';
import type { Reciter } from '@/types';
import { seekBy } from '@/utils/clamp';

/**
 * The site is this screen. There is no navigation: the two sheets are the only
 * way out of the player, and they close back onto it.
 */
export default function PlayerPage() {
  const { reciters } = useReciters();
  const { sheet, openSurahs, openReciters, close } = useSheet();

  const [reciter, setReciter] = useAtom(selectedReciterAtom);
  const [isPlaying, setIsPlaying] = useAtom(isPlayingAtom);
  const [error] = useAtom(torrentErrorAtom);
  const setRetrySignal = useSetAtom(retrySignalAtom);

  const position = useAtomValue(positionAtom);
  const { surahId, duration, ready, selectSurah, playSurah, seekTo, next, previous } =
    usePlayerNav();

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
    restoreFor(saved);
  }, [reciters, restoreFor, setReciter]);

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

  const surah = surahById(surahId);

  return (
    <main className="player-screen">
      <div className="w-full max-w-[520px]">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={openReciters}
            className="h-11 rounded-full px-3 text-[15px] text-muted transition-colors hover:text-ink"
          >
            {reciter?.name ?? 'اختر قارئاً'}
          </button>
        </div>

        <h1 className="mt-2 text-center text-[44px] font-semibold leading-[1.2] text-ink">
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

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={openSurahs}
            className="h-11 rounded-full px-3 text-[15px] text-muted transition-colors hover:text-ink"
          >
            السور
          </button>
        </div>
      </div>

      <Sheet title="السور" open={sheet === 'surahs'} onClose={close}>
        <SurahSheet open={sheet === 'surahs'} current={surahId} onPick={pickSurah} />
      </Sheet>

      <Sheet title="القرّاء" open={sheet === 'reciters'} onClose={close}>
        <ReciterSheet reciters={reciters} current={reciter?.id} onPick={pickReciter} />
      </Sheet>
    </main>
  );
}
