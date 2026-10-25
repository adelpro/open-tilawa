import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import type { Instance, Torrent, TorrentFile } from 'webtorrent';

import { rtcConfig, TRACKERS } from '@/constants';
import { selectedReciterAtom, webtorrentReadyAtom } from '@/jotai/atom';
import { TorrentInfo, TrackType } from '@/types';
import { getErrorMessage, isValidMagnetUri, updateMagnetURI } from '@/utils';

const TORRENT_READY_TIMEOUT = 10_000; // 10s: metadata from .torrent should arrive well before this
const MAX_AUTO_RETRIES = 3;

export default function useTorrent() {
  const webtorrentReady = useAtomValue(webtorrentReadyAtom);
  const selectedReciterValue = useAtomValue(selectedReciterAtom);
  const magnetURI = selectedReciterValue?.magnet || undefined;

  const [torrentInfo, setTorrentInfo] = useState<TorrentInfo | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [retryCount, setRetryCount] = useState(0);
  const [autoRetryCount, setAutoRetryCount] = useState(0);

  // Reset auto-retry counter when the selected reciter changes.
  useEffect(() => {
    setAutoRetryCount(0);
  }, [magnetURI]);
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
      // Extract ALL web seed base URLs (ws=) from magnet for HTTP streaming.
      // Auto-discover every mirror so playback can fall back if one is down.
      const wsMatches = [...updatedMagnetURI.matchAll(/[?&]ws=([^&]+)/g)];
      const webSeedBases = wsMatches.map((m) => decodeURIComponent(m[1]));
      const webSeedBase = webSeedBases.length ? webSeedBases[0] : '';
      // Try torrent file URL (provides metadata without WebRTC)
      const torrentFileUrl = infoHash ? '/torrents/' + infoHash + '.torrent?v=' + Date.now() : '';

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
            console.log('Torrent file HEAD:', torrentFileUrl, resp.status);
            if (resp.ok) {
              const opts: any = { announce: TRACKERS };
              if (webSeedBase) opts.urlList = [webSeedBase];
              torrent = localClient.add(torrentFileUrl, opts) as any;
              added = true;
              console.log('Torrent added from file:', torrent?.infoHash);
            } else {
              // .torrent missing: fall back to magnet. In a browser this only
              // works if WebRTC-reachable peers exist (HTTP trackers are dropped
              // by updateMagnetURI). Surface a retryable error via the 10s timeout.
              console.log('Torrent file not found, using magnet');
            }
          } catch (e) {
            console.error('Torrent file fetch error:', e);
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
          // Keep the TorrentFile reference so non-web-seed reciters can stream
          // incrementally via file.streamTo() instead of loading the whole file.
          // webSeeds holds every discovered mirror for fallback.
          return { surahId, link, file, webSeeds: webSeedBases };
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

      readyTimeout = setTimeout(() => {
        if (cancelled || torrent.ready) return;
        if (autoRetryCount < MAX_AUTO_RETRIES) {
          setAutoRetryCount((c) => c + 1);
          setRetryCount((c) => c + 1);
        } else {
          setError('Timeout: Could not fetch torrent metadata. Please try again later.');
        }
      }, TORRENT_READY_TIMEOUT);

      const onReady = () => {
        clearTimeout(readyTimeout);
        setError(undefined);
        showPlaylist();
      };

      const onNoPeers = (announceType: string) => {
        const message = `No peers found for ${announceType} trackers. Please check your internet connection or try again later.`;
        setError(message);
      };

      if (torrent.ready) {
        clearTimeout(readyTimeout);
        setError(undefined);
        showPlaylist();
      }

      torrent.on('error', (err: any) => {
        console.error('Torrent error:', err?.message || err);
        setError('Torrent error: ' + (err?.message || err));
      });
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
  }, [magnetURI, webtorrentReady, retryCount, autoRetryCount]);

  return { torrentInfo, error, setError, retry: () => setRetryCount((c) => c + 1) };
}
