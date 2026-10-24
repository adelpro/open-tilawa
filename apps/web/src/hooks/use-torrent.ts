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
    if (webtorrentReady && !clientRef.current && window.WebTorrent) {
      clientRef.current = new window.WebTorrent({
        tracker: { rtcConfig },
      });
    }
  }, [webtorrentReady]);

  // Add torrent when client is ready and a valid magnet URI exists
  useEffect(() => {
    setTorrentInfo(undefined);
    setError(undefined);

    if (!magnetURI) {
      return;
    }

    if (!webtorrentReady || !clientRef.current) {
      setError('WebTorrent client is not ready.');
      return;
    }

    if (!isValidMagnetUri(magnetURI)) {
      setError('Invalid Magnet-URI provided.');
      return;
    }

    const localClient = clientRef.current;
    const updatedMagnetURI = updateMagnetURI(magnetURI);

    // Extract web seed base URL (ws=) from magnet for HTTP streaming
    const wsMatch = updatedMagnetURI.match(/[?&]ws=([^&]+)/);
    const webSeedBase = wsMatch ? decodeURIComponent(wsMatch[1]) : '';

    // Clean up any other torrents
    for (const t of localClient.torrents) {
      if (t.magnetURI !== updatedMagnetURI) {
        t.destroy();
      }
    }

    let torrent: any = localClient.get(updatedMagnetURI);
    if (!torrent) {
      torrent = localClient.add(updatedMagnetURI, { announce: TRACKERS }) as any;
    }

    const mp3Files = () =>
      (torrent.files || []).filter((file: TorrentFile) =>
        file.name.endsWith('.mp3')
      );

    // Show playlist immediately on metadata ready (don't wait for all blobs)
    const showPlaylist = () => {
      const files: TrackType[] = mp3Files().map((file: TorrentFile) => {
        const surahId = Number(file.name.split('.')[0]);
        // Use web seed HTTP URL for streaming if available
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

    // Load blob URLs in the background, updating state incrementally
    const loadBlobUrls = async () => {
      const files = mp3Files();
      for (const file of files) {
        const surahId = Number(file.name.split('.')[0]);
        // Skip if already has a web seed URL (streaming from HTTP)
        if (webSeedBase) continue;
        try {
          const blob = await (file as any).blob();
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

    const readyTimeout = setTimeout(() => {
      if (!torrent.ready) {
        setError(
          'Timeout: Could not fetch torrent metadata. Please try again later.'
        );
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

    const onError = (torrentError: Error) => {
      clearTimeout(readyTimeout);
      setError(getErrorMessage(torrentError));
    };

    if (torrent.ready) {
      showPlaylist();
      loadBlobUrls();
    }

    torrent.on('ready', onReady);
    torrent.on('download', () => {
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
      setTorrentInfo((prev) =>
        prev ? { ...prev, peers: torrent.numPeers } : prev
      );
    });
    torrent.on('noPeers', onNoPeers);
    //torrent.on('error', onError);

    return () => {
      clearTimeout(readyTimeout);
      torrent.removeListener('ready', onReady);
      torrent.removeListener('download', () => {});
      torrent.removeListener('wire', () => {});
      torrent.removeListener('noPeers', onNoPeers);
      torrent.removeListener('error', onError);
    };
  }, [magnetURI, webtorrentReady]);

  return { torrentInfo, error, setError };
}
