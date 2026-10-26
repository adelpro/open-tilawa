'use client';
import { formatSpeed } from '../utils/format-speed';

import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { ReactNode } from 'react';

import AudioPlayer from '@/components/audio-player';
import useTorrent from '@/hooks/use-torrent';
import { selectedReciterAtom, webtorrentReadyAtom } from '@/jotai/atom';

import Loader from './loader';

export default function TorrentPlayer() {
  const [webtorrentReady, setWebTorrentReady] = useAtom(webtorrentReadyAtom);
  const { error, setError, torrentInfo, retry } = useTorrent();
  const selectedReciterValue = useAtomValue(selectedReciterAtom);

  // Track how long the spinner has been showing, to add a helpful hint.
  const [spinnerSeconds, setSpinnerSeconds] = useState(0);
  useEffect(() => {
    if (torrentInfo?.ready || error) {
      setSpinnerSeconds(0);
      return;
    }
    if (!selectedReciterValue?.magnet) return;
    const id = setInterval(() => setSpinnerSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [torrentInfo?.ready, error, selectedReciterValue?.magnet]);

  useEffect(() => {
    if (webtorrentReady) return;
    if ((window as any).WebTorrent) {
      setWebTorrentReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod: any = await new Function('return import("/webtorrent.min.js")')();
        const WT = mod?.default || mod;
        if (cancelled) return;
        (window as any).WebTorrent = WT;
        setWebTorrentReady(true);
        setError(undefined);
      } catch (e) {
        if (cancelled) return;
        setError('Failed to load WebTorrent: ' + (e as Error).message);
        setWebTorrentReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [webtorrentReady, setWebTorrentReady, setError]);

  // Prefer an archive.org web seed if present, otherwise the first ws=.
  const allWs = selectedReciterValue?.magnet?.match(/(?:^|&)ws=([^&]+)/g) || [];
  const wsUrls = allWs.map((m) => decodeURIComponent(m.replace(/^(?:^|&)ws=/, '')));
  const wsUrl = wsUrls.find((u) => u.includes('archive.org')) || wsUrls[0] || null;

  const content = (): ReactNode => {
    if (error) {
      return (
        <div className="flex flex-col items-center gap-2 text-lg">
          <p>خطأ: {error}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                setError(undefined);
                retry();
              }}
              className="rounded bg-slate-200 px-3 py-1 text-sm hover:bg-slate-300"
            >
              إعادة المحاولة
            </button>
            {wsUrl && (
              <a
                href={wsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-slate-200 px-3 py-1 text-sm hover:bg-slate-300"
              >
                تشغيل من المصدر (archive.org)
              </a>
            )}
          </div>
        </div>
      );
    }
    if (!webtorrentReady) {
      return (
        <Loader
          message="جاري تحميل Webtorrent"
          textClassName="text-lg"
          rightIcon
        />
      );
    }

    if (!selectedReciterValue?.magnet) {
      return <></>;
    }

    if (!torrentInfo?.ready) {
      return (
        <div className="flex flex-col items-center gap-1">
          <Loader message="جاري تحميل الملف" textClassName="text-lg" rightIcon />
          {spinnerSeconds >= 3 && (
            <p className="text-xs text-gray-500">
              {spinnerSeconds < 8
                ? 'جاري جلب البيانات الوصفية…'
                : 'يستغرق أطول من المتوقع. تحقق من الاتصال أو جرّب "تشغيل من المصدر".'}
            </p>
          )}
          {torrentInfo && (
            <p className={`text-xs ${torrentInfo.peers === 0 ? 'text-red-500' : 'text-gray-400'}`}>
              peers: {torrentInfo.peers} · ↓ {formatSpeed(torrentInfo.downloadSpeed)} · ↑ {formatSpeed(torrentInfo.uploadSpeed)}
            </p>
          )}
          {spinnerSeconds >= 8 && (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button
                onClick={() => {
                  setError(undefined);
                  retry();
                }}
                className="rounded bg-slate-200 px-3 py-1 text-sm hover:bg-slate-300"
              >
                إعادة المحاولة
              </button>
              {wsUrl && (
                <a
                  href={wsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-slate-200 px-3 py-1 text-sm hover:bg-slate-300"
                >
                  تشغيل من المصدر (archive.org)
                </a>
              )}
            </div>
          )}
        </div>
      );
    }

    if (torrentInfo.files.length === 0) {
      return <p className="text-lg">لم يتم العثور على ملفات</p>;
    }

    return <></>;
  };

  return (
    <div className="flex flex-col gap-2">
      {torrentInfo?.files.length ? (
        <div className="flex flex-col gap-5">
          <AudioPlayer playlist={torrentInfo.files} />
          {torrentInfo.ready && (
            <p className="text-center text-xs text-gray-400">
              peers: {torrentInfo.peers} · ↓ {formatSpeed(torrentInfo.downloadSpeed)} · ↑ {formatSpeed(torrentInfo.uploadSpeed)} ·{' '}
              {(torrentInfo.progress * 100).toFixed(1)}%
            </p>
          )}
        </div>
      ) : (
        <></>
      )}

      {content()}
    </div>
  );
}
