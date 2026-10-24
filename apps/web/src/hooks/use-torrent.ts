import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import type { Instance, Torrent, TorrentFile } from 'webtorrent';

import { rtcConfig, TRACKERS } from '@/constants';
import { selectedReciterAtom, webtorrentReadyAtom } from '@/jotai/atom';
import { TorrentInfo, TrackType } from '@/types';
import { getErrorMessage, isValidMagnetUri, updateMagnetURI } from '@/utils';

const TORRENT_READY_TIMEOUT = 60_000; // 1 min

export default function useTorrent() {
  const webtorrentReady = useAtomValue(webtorrentReadyAtom);
  const selectedReciterValue = useAtomValue(selectedReciterAtom);
  const magnetURI = selectedReciterValue?.magnet || undefined;

  const [torrentInfo, setTorrentInfo] = useState<TorrentInfo | undefined>();
  const [error, setError] = useState<string | undefined>();
  const clientRef = useRef<Instance | undefined>(undefined);

  // Initialize WebTorrent client once on mount
  useEffect(() => {
    if (!webtorrentReady) return;
    if (clientRef.current) return;
    const tryInit = () => {
      if (clientRef.current) return;
      if ((window as any).WebTorrent) {
        try {
          clientRef.current = new (window as any).WebTorrent({
            tracker: { rtcConfig },
          });
          setError(undefined);
        } catch (e) {
          setError('Failed to init WebTorrent: ' + (e as Error).message);
        }
      } else {
        setTimeout(tryInit, 200);
      }
    };
    tryInit();
  }, [webtorrentReady]);

  // Add torrent when client is ready and a valid magnet URI exists
  useEffect(() => {
    setTorrentInfo(undefined);
    setError(undefined);

    if (!magnetURI) return;
    if (!webtorrentReady) return;

    let cancelled = false;
    let torrent: any = null;
    let readyTimeout: ReturnType<typeof setTimeout>;

    const run = async () => {
      if (cancelled) return;
      if (!clientRef.current) {
        setTimeout(run, 200);
        return;
      }

      const localClient = clientRef.current;

      if (!isValidMagnetUri(magnetURI)) {
        setError('Invalid Magnet-URI provided.');
        return;
      }

      const updatedMagnetURI = updateMagnetURI(magnetURI);

      // Extract infohash for torrent file lookup
      const infoHashMatch = updatedMagnetURI.match(/btih:([a-zA-Z0-9]+)/);
      const infoHash = infoHashMatch ? infoHashMatch[1].toLowerCase() : '';
      // Extract web seed base URL (ws=) from magnet for HTTP streaming
      const wsMatch = updatedMagnetURI.match(/[?&]ws=([^&]+)/);
      const webSeedBase = wsMatch ? decodeURIComponent(wsMatch[1]) : '';
      // Try torrent file URL (provides metadata without WebRTC)
      const torrentFileUrl = infoHash ? '/torrents/' + infoHash + '.torrent' : '';

      // Clean up any other torrents
      for (const t of localClient.torrents) {
        if (t.magnetURI !== updatedMagnetURI) {
          t.destroy();
        }
      }

      torrent = localClient.get(updatedMagnetURI);
      if (!torrent) {
        // Try torrent file first (provides metadata without WebRTC)
        let added = false;
        if (torrentFileUrl) {
          try {
            const resp = await fetch(torrentFileUrl, { method: 'HEAD' });
            if (resp.ok) {
              const opts: any = { announce: TRACKERS };
              if (webSeedBase) opts.urlList = [webSeedBase];
              torrent = localClient.add(torrentFileUrl, opts) as any;
              added = true;
            }
          } catch (e) {
            // Fall through to magnet
          }
        }
        if (!added) {
          torrent = localClient.add(updatedMagnetURI, { announce: TRACKERS }) as any;
        }
      }


      const mp3Files = () =>
        (torrent.files || []).filter((file: TorrentFile) =>
          file.name.endsWith('.mp3')
        );

      const showPlaylist = () => {
        const files: TrackType[] = mp3Files().map((file: TorrentFile) => {
          const surahId = Number(file.name.split('.')[0]);
          const link = webSeedBase ? webSeedBase + file.name : '';
          return { surahId, link };
        });
        setTorrentInfo({
          magnetURI: torrent.magnetURI,
          downloaded: torrent.downloaded,
          downloadSpeed: torrent.downloadSpeed,
          uploadSpeed: torrent.uploadSpeed,
          progress: torrent.progress,
          peers: torrent.numPeers,
          files,
          ready: true,
        });
      };

      const loadBlobUrls = async () => {
        if (webSeedBase) return; // already streaming from HTTP
        const files = mp3Files();
        for (const file of files) {
          if (cancelled) return;
          const surahId = Number(file.name.split('.')[0]);
          try {
            const blob = await (file as any).blob();
            if (cancelled) return;
            const blobURL = URL.createObjectURL(blob);
            setTorrentInfo((prev) => {
              if (!prev) return prev;
              const updated = prev.files.map((t) =>
                t.surahId === surahId ? { ...t, link: blobURL } : t
              );
              return { ...prev, files: updated };
            });
          } catch (error) {
            const errorMessage = getErrorMessage(error);
            setTorrentInfo((prev) => {
              if (!prev) return prev;
              const updated = prev.files.map((t) =>
                t.surahId === surahId ? { ...t, error: errorMessage } : t
              );
              return { ...prev, files: updated };
            });
          }
        }
      };

      readyTimeout = setTimeout(() => {
        if (!torrent.ready && !cancelled) {
          setError('Timeout: Could not fetch torrent metadata. Please try again later.');
        }
      }, TORRENT_READY_TIMEOUT);

      const onReady = () => {
        clearTimeout(readyTimeout);
        setError(undefined);
        showPlaylist();
        loadBlobUrls();
      };

      const onNoPeers = (announceType: string) => {
        const message = `No peers found for ${announceType} trackers. Please check your internet connection or try again later.`;
        setError(message);
      };

      if (torrent.ready) {
        clearTimeout(readyTimeout);
        setError(undefined);
        showPlaylist();
        loadBlobUrls();
      }

      torrent.on('ready', onReady);
      torrent.on('download', () => {
        if (cancelled) return;
        setTorrentInfo((prev) =>
          prev
            ? {
                ...prev,
                downloaded: torrent.downloaded,
                downloadSpeed: torrent.downloadSpeed,
                uploadSpeed: torrent.uploadSpeed,
                progress: torrent.progress,
                peers: torrent.numPeers,
              }
            : prev
        );
      });
      torrent.on('wire', () => {
        if (cancelled) return;
        setTorrentInfo((prev) =>
          prev ? { ...prev, peers: torrent.numPeers } : prev
        );
      });
      torrent.on('noPeers', onNoPeers);
    };

    run();

    return () => {
      cancelled = true;
      if (readyTimeout) clearTimeout(readyTimeout);
    };
  }, [magnetURI, webtorrentReady]);

  return { torrentInfo, error, setError };
}
