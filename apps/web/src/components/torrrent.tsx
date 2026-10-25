'use client';

import { useAtom, useAtomValue } from 'jotai';
import { useEffect } from 'react';
import { ReactNode } from 'react';

import MusicPlayer from '@/components/music-player';
import useTorrent from '@/hooks/use-torrent';
import { selectedReciterAtom, webtorrentReadyAtom } from '@/jotai/atom';

import Loader from './loader';

export default function TorrentPlayer() {
  const [webtorrentReady, setWebTorrentReady] = useAtom(webtorrentReadyAtom);
  const { error, setError, torrentInfo, retry } = useTorrent();
  const selectedReciterValue = useAtomValue(selectedReciterAtom);

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

  const content = (): ReactNode => {
    if (error) {
      const wsMatch = selectedReciterValue?.magnet?.match(/(?:^|&)ws=([^&]+)/);
      const wsUrl = wsMatch ? decodeURIComponent(wsMatch[1]) : null;
      return (
        <div className="flex flex-col items-center gap-2 text-lg">
          <p>خطأ: {error}</p>
          <div className="flex gap-2">
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
                تشغيل من المصدر
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
        <Loader message="جاري تحميل الملف" textClassName="text-lg" rightIcon />
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
        </div>
      ) : (
        <></>
      )}

      {content()}
    </div>
  );
}
