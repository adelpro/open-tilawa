import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import type { Instance, Torrent, TorrentFile } from "webtorrent";

import { rtcConfig, TRACKERS } from "@/constants";
import { selectedReciterAtom, webtorrentReadyAtom } from "@/jotai/atom";
import { TorrentInfo, TrackType } from "@/types";
import { isValidMagnetUri, updateMagnetURI } from "@/utils";

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

    if (!webtorrentReady) return;

    // No torrent yet (e.g. Itqan-sourced reciter): build the playlist directly
    // from the reciter's Itqan MP3 links so playback works without peers.
    if (!magnetURI) {
      const itqanPlaylist = selectedReciterValue?.itqanPlaylist;
      if (itqanPlaylist && itqanPlaylist.length > 0) {
        setTorrentInfo({
          magnetURI: "",
          downloaded: 0,
          downloadSpeed: 0,
          uploadSpeed: 0,
          progress: 1,
          peers: 0,
          files: itqanPlaylist
            .slice()
            .sort((a, b) => a.surahId - b.surahId)
            .map((track) => ({
              surahId: track.surahId,
              link: track.link,
              file: undefined,
              webSeeds: [],
            })),
          ready: true,
        });
      }
      return;
    }

    let cancelled = false;
    let torrent: any = null;
    let readyTimeout: ReturnType<typeof setTimeout>;

    const run = async () => {
      if (cancelled) return;
      if (!(window as any).WebTorrent) {
        setTimeout(run, 200);
        return;
      }

      const localClient = new (window as any).WebTorrent({
        tracker: { rtcConfig },
      });

      if (!isValidMagnetUri(magnetURI)) {
        setError("Invalid Magnet-URI provided.");
        return;
      }

      const updatedMagnetURI = updateMagnetURI(magnetURI);

      const infoHashMatch = magnetURI.match(/btih:([a-zA-Z0-9]+)/);
      const infoHash = infoHashMatch ? infoHashMatch[1].toLowerCase() : "";
      const torrentFileUrl = infoHash
        ? "/torrents/" + infoHash + ".torrent"
        : "";

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
          console.error("Torrent file fetch error:", e);
        }
      }
      if (!added) {
        torrent = localClient.add(updatedMagnetURI, {
          announce: TRACKERS,
        }) as any;
      }

      const mp3Files = () =>
        (torrent.files || []).filter((file: TorrentFile) =>
          file.name.endsWith(".mp3"),
        );

      const showPlaylist = () => {
        const files: TrackType[] = mp3Files()
          .map((file: TorrentFile) => {
            // Extract surah number from various naming patterns:
            //   '001.mp3', 'ar_001_Name.mp3', 'ar_Name_001.mp3'
            const surahMatch = file.name.match(/(\d{1,3})/);
            const surahId = surahMatch ? Number(surahMatch[1]) : 0;
            return { surahId, link: "", file, webSeeds: [] };
          })
          .sort((a: TrackType, b: TrackType) => a.surahId - b.surahId);
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
        setError(
          "Timeout: Could not fetch torrent metadata. Please try again later.",
        );
      }, TORRENT_READY_TIMEOUT);

      if (torrent.ready) {
        clearTimeout(readyTimeout);
        setError(undefined);
        showPlaylist();
      } else {
        torrent.on("ready", () => {
          clearTimeout(readyTimeout);
          setError(undefined);
          showPlaylist();
        });
      }

      torrent.on("error", (err: any) => {
        console.error("Torrent error:", err?.message || err);
        setError("Torrent error: " + (err?.message || err));
      });
      torrent.on("download", () => {
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
            : prev,
        );
      });
      torrent.on("wire", () => {
        if (cancelled) return;
        setTorrentInfo((prev) =>
          prev ? { ...prev, peers: torrent.numPeers } : prev,
        );
      });
    };

    run();

    return () => {
      cancelled = true;
      if (readyTimeout) clearTimeout(readyTimeout);
    };
  }, [
    magnetURI,
    webtorrentReady,
    retryCount,
    selectedReciterValue?.itqanPlaylist,
  ]);

  return {
    torrentInfo,
    error,
    setError,
    retry: () => setRetryCount((c) => c + 1),
  };
}
