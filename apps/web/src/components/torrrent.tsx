'use client';

import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { ReactNode } from 'react';

import MusicPlayer from '@/components/music-player';
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
    if (webtorrentReady || window.WebTorrent) {
      if (window.WebTorrent && !webtorrentReady) setWebTorrentReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/webtorrent@3.0.21/dist/webtorrent.min.js';
    script.async = true;
    script.onload = () => {
      setWebTorrentReady(true);
      setError(undefined);
    };
    script.onerror = () => {
      setError('Failed to load WebTorrent');
      setWebTorrentReady(false);
    };
    document.head.appendChild(script);
    return () => {
      // cleanup not needed
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
            <p className="text-xs text-gray-400">
              peers: {torrentInfo.peers} · {(torrentInfo.downloadSpeed / 1024).toFixed(0)} KB/s
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
          <MusicPlayer playlist={torrentInfo.files} />
          {torrentInfo.ready && (
            <p className="text-center text-xs text-gray-400">
              peers: {torrentInfo.peers} · ↓ {(torrentInfo.downloadSpeed / 1024).toFixed(0)} KB/s ·{' '}
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
