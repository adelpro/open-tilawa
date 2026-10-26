import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Icon } from '@/components/icons';
import NowPlaying from '@/components/now-playing';
import { Fidelity } from '@/components/player-bits';
import QueueSheet from '@/components/queue-sheet';
import { surahById } from '@/constants/surah';
import { usePlayerNav } from '@/hooks/use-player-nav';
import { loadState, patchState } from '@/hooks/use-persistence';
import { useReciters } from '@/hooks/use-reciters';
import { selectedReciterAtom } from '@/jotai/atom';
import { currentIndexAtom, queueOpenAtom, torrentAtom } from '@/jotai/player';
import { formatTime } from '@/utils/format-time';

/**
 * `/reciter/:id` and `/reciter/:id/:surah`.
 *
 * The route is the source of truth for *which* surah: a deep link, a browser
 * back, and a share all mean the same thing. The page translates the URL into
 * the engine's index and never the other way round.
 */
export default function ReciterPage() {
  const { id, surah } = useParams();
  const navigate = useNavigate();
  const reciterId = Number(id);
  const surahId = surah === undefined ? undefined : Number(surah);

  const { reciters } = useReciters();
  const setSelected = useSetAtom(selectedReciterAtom);
  const setIndex = useSetAtom(currentIndexAtom);
  const setQueueOpen = useSetAtom(queueOpenAtom);
  const torrent = useAtomValue(torrentAtom);
  const { playIndex } = usePlayerNav();

  const reciter = reciters.find((candidate) => candidate.id === reciterId);
  const files = torrent?.files ?? [];
  const savedRef = useRef(loadState());
  const saved = savedRef.current;

  /** The rail's "current reciter" follows the route, not the click. */
  useEffect(() => {
    if (!reciter) return;
    setSelected(reciter);
    patchState({ reciterId: reciter.id });
  }, [reciter, setSelected]);

  /** URL → index. A surah this reciter does not carry becomes -1 (nothing plays). */
  useEffect(() => {
    if (!surahId || files.length === 0) return;
    const at = files.findIndex((track, i) => (track.surahId > 0 ? track.surahId : i + 1) === surahId);
    setIndex(at);
  }, [surahId, files, setIndex]);

  /** The idle desk has no current track: the queue shows its full list instead. */
  useEffect(() => {
    if (surah === undefined) setIndex(-1);
  }, [surah, setIndex]);

  useEffect(() => {
    if (surah) return;
    document.title = reciter ? `${reciter.name} — Open Tilawa` : 'Open Tilawa';
  }, [surah, reciter]);

  /** A nonsense surah id is a broken link, not a state. */
  useEffect(() => {
    if (surah === undefined) return;
    if (!Number.isFinite(surahId) || !surahById(surahId)) {
      navigate(`/reciter/${reciterId}`, { replace: true });
    }
  }, [surah, surahId, reciterId, navigate]);

  const resume = useMemo(() => {
    const entry = saved.positions[String(reciterId)];
    if (!entry) return undefined;
    const target = surahById(entry.surahId);
    if (!target) return undefined;
    return { ...entry, surah: target };
  }, [saved.positions, reciterId]);

  if (!Number.isFinite(reciterId)) {
    return <MissingReciter />;
  }

  return (
    <>
      {surahId && surahById(surahId) ? (
        <NowPlaying surahId={surahId} />
      ) : (
        <div className="flex min-h-full flex-col justify-center px-6 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-6 flex items-center justify-between lg:hidden">
              <Link
                to="/"
                aria-label="رجوع"
                className="-ms-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-secondary"
              >
                <Icon name="chevron" size={22} className="rotate-180" />
              </Link>
              <Fidelity p2p={Boolean(reciter?.magnet)} />
            </div>

            <p className="text-[11px] font-semibold text-ink-tertiary">القارئ</p>
            <h1 className="mt-1 font-display text-[clamp(2.75rem,9vw,4.5rem)] leading-[1.35]">
              {reciter?.name ?? 'قارئ غير معروف'}
            </h1>
            <p className="mt-2 text-[12px] text-ink-secondary">
              {files.length > 0 ? (
                <span className="tnum">{files.length} سورة متاحة الآن</span>
              ) : (
                'جارٍ تحضير التلاوة…'
              )}
            </p>

            {resume && (
              <button
                type="button"
                onClick={() => navigate(`/reciter/${reciterId}/${resume.surahId}`)}
                className="mt-8 flex w-full items-center gap-3 rounded-lg border border-divider bg-surface-1 px-4 py-3 text-start transition-colors hover:bg-surface-2/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas">
                  <Icon name="play" size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-ink-tertiary">تابع من حيث توقفت</span>
                  <span className="block truncate text-[15px] font-semibold">{resume.surah.name}</span>
                </span>
                <span className="tnum shrink-0 text-[11px] text-ink-tertiary">
                  {formatTime(resume.position)}
                </span>
              </button>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={files.length === 0}
                onClick={() => playIndex(0)}
                className="rounded-pill bg-ink px-5 py-2.5 text-[13px] font-semibold text-canvas disabled:opacity-40"
              >
                تشغيل من البداية
              </button>

              <button
                type="button"
                onClick={() => setQueueOpen(true)}
                className="rounded-pill border border-divider px-5 py-3 text-[13px] text-ink-secondary lg:hidden"
              >
                قائمة السور
              </button>

              <span className="hidden text-[12px] text-ink-tertiary lg:inline">
                اختر سورة من القائمة
              </span>
            </div>

            <p className="mt-10 text-[11px] leading-relaxed text-ink-tertiary">
              الملفات تُقرأ مباشرة من التورنت أثناء التشغيل. لا حساب، ولا تتبّع.
            </p>
          </div>
        </div>
      )}

      <QueueSheet />
    </>
  );
}

function MissingReciter() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-lg font-semibold">القارئ غير موجود</p>
      <p className="text-[13px] text-ink-secondary">الرابط لا يشير إلى قارئ معروف.</p>
      <Link to="/" className="mt-2 rounded-pill bg-ink px-4 py-2 text-[13px] font-semibold text-canvas">
        العودة إلى المكتبة
      </Link>
    </div>
  );
}
