import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import type { Instance, Torrent, TorrentFile } from 'webtorrent';

import { rtcConfig, TRACKERS } from '@/constants';
import { selectedReciterAtom, webtorrentReadyAtom } from '@/jotai/atom';
import { TorrentInfo, TrackType } from '@/types';
import { isValidMagnetUri, updateMagnetURI } from '@/utils';

const TORRENT_READY_TIMEOUT = 10_000;

export default function useTorrent() {
  const webtorrentReady = useAtomValue(webtorrentReadyAtom);
  const selectedReciterValue = useAtomValue(selectedReciterAtom);
  const magnetURI = selectedReciterValue?.magnet || undefined;

  const [torrentInfo, setTorrentInfo] = useState<TorrentInfo | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [retryCount, setRetryCount] = useState(0);

  // No persistent client — create a fresh one per run to avoid stale state.
  const clientRef = useRef<Instance | undefined>(undefined);

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
      if (!(window as any).WebTorrent) {
        setTimeout(run, 200);
        return;
      }

      const localClient = new (window as any).WebTorrent({ tracker: { rtcConfig } });

      if (!isValidMagnetUri(magnetURI)) {
        setError('Invalid Magnet-URI provided.');
        return;
      }

      const updatedMagnetURI = updateMagnetURI(magnetURI);

      const infoHashMatch = magnetURI.match(/btih:([a-zA-Z0-9]+)/);
      const infoHash = infoHashMatch ? infoHashMatch[1].toLowerCase() : '';
      const wsMatches = [...magnetURI.matchAll(/[?&]ws=([^&]+)/g)];
      const webSeedBases = wsMatches.map((m) => decodeURIComponent(m[1]));
      const webSeedBase = webSeedBases.length ? webSeedBases[0] : '';
      const torrentFileUrl = infoHash ? '/torrents/' + infoHash + '.torrent' : '';

      let added = false;
      if (torrentFileUrl) {
        try {
          const resp = await fetch(torrentFileUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            torrent = localClient.add(blob as any) as any;
            added = true;
          }
        } catch (e) {
          console.error('Torrent file fetch error:', e);
        }
      }
      if (!added) {
        torrent = localClient.add(updatedMagnetURI, { announce: TRACKERS }) as any;
      }

      const mp3Files = () =>
        (torrent.files || []).filter((file: TorrentFile) =>
          file.name.endsWith('.mp3')
        );

      const showPlaylist = () => {
        const files: TrackType[] = mp3Files().map((file: TorrentFile) => {
          const surahId = Number(file.name.split('.')[0]);
          const link = webSeedBase ? webSeedBase + file.name : '';
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
        setError('Timeout: Could not fetch torrent metadata. Please try again later.');
      }, TORRENT_READY_TIMEOUT);

      if (torrent.ready) {
        clearTimeout(readyTimeout);
        setError(undefined);
        showPlaylist();
      } else {
        torrent.on('ready', () => {
          clearTimeout(readyTimeout);
          setError(undefined);
          showPlaylist();
        });
      }

      torrent.on('error', (err: any) => {
        console.error('Torrent error:', err?.message || err);
        setError('Torrent error: ' + (err?.message || err));
      });
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
    };

    run();

    return () => {
      cancelled = true;
      if (readyTimeout) clearTimeout(readyTimeout);
    };
  }, [magnetURI, webtorrentReady, retryCount]);

  return { torrentInfo, error, setError, retry: () => setRetryCount((c) => c + 1) };
}
