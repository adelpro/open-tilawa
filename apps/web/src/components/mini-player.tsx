import { useAtomValue, useSetAtom } from 'jotai';
import { Link, useLocation } from 'react-router-dom';

import { Equalizer } from '@/components/player-bits';
import { surahById } from '@/constants/surah';
import { surahIdOf } from '@/hooks/use-player-nav';
import { selectedReciterAtom } from '@/jotai/atom';
import {
  currentIndexAtom,
  durationAtom,
  isPlayingAtom,
  positionAtom,
  torrentAtom,
} from '@/jotai/player';

/**
 * The bar that keeps the surah in the room while you browse. It sits above the
 * tab bar, taps through to the desk, and carries the only progress line you see
 * outside it.
 */
export default function MiniPlayer() {
  const reciter = useAtomValue(selectedReciterAtom);
  const torrent = useAtomValue(torrentAtom);
  const index = useAtomValue(currentIndexAtom);
  const playing = useAtomValue(isPlayingAtom);
  const setIsPlaying = useSetAtom(isPlayingAtom);
  const position = useAtomValue(positionAtom);
  const duration = useAtomValue(durationAtom);
  const { pathname } = useLocation();

  const files = torrent?.files ?? [];
  const track = files[index];
  if (!reciter || !track) return null;

  // On the desk itself the full player is already on screen.
  if (/^\/reciter\/[^/]+\/\d+\/?$/.test(pathname)) return null;

  const surahId = surahIdOf(track, index);
  const surah = surahById(surahId);
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-divider bg-surface-1 lg:hidden">
      <div className="h-[2px] w-full bg-surface-2">
        <div className="h-full bg-ink" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        <Link
          to={`/reciter/${reciter.id}/${surahId}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <Equalizer active={playing} className="text-accent" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{surah?.name ?? `سورة ${surahId}`}</p>
            <p className="truncate text-[11px] text-ink-secondary">{reciter.name}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setIsPlaying(!playing)}
          aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            {playing ? (
              <path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" fill="currentColor" />
            ) : (
              <path d="M7 4.5 20 12 7 19.5z" fill="currentColor" />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
}
