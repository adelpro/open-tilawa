import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import type { TorrentFile } from "webtorrent";

import { TRACKERS } from "@/constants";
import { selectedReciterAtom, webtorrentReadyAtom } from "@/jotai/atom";
import { retrySignalAtom } from "@/jotai/player";
import { TorrentInfo, TrackType } from "@/types";
import {
  getWebTorrentClient,
  hasStreamingServer,
  parseMagnet,
  updateMagnetURI,
} from "@/utils";
import { closeTorrentSession, openTorrentSession } from "@/utils/torrent-session";

const TORRENT_READY_TIMEOUT = 10_000;

export default function useTorrent() {
  const webtorrentReady = useAtomValue(webtorrentReadyAtom);
  const selectedReciterValue = useAtomValue(selectedReciterAtom);
  const magnetURI = selectedReciterValue?.magnet || undefined;

  const [torrentInfo, setTorrentInfo] = useState<TorrentInfo | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [retryCount, setRetryCount] = useAtom(retrySignalAtom);

  // The torrent outlives this hook (see utils/torrent-session): the client is a
  // module singleton and several components read the same session, so this
  // effect attaches listeners rather than owning an add.

  // Add torrent when client is ready and a valid magnet URI exists
  useEffect(() => {
    setTorrentInfo(undefined);
    setError(undefined);

    if (!webtorrentReady) return;

    // No torrent yet (e.g. Itqan-sourced reciter): build the playlist directly
    // from the reciter's Itqan MP3 links so playback works without peers.
    if (!magnetURI) {
      // An HTTP-only reciter needs no torrent; drop the one still seeding.
      void closeTorrentSession();
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
    let detach: (() => void) | undefined;

    const run = async () => {
      if (cancelled) return;
      if (!(window as any).WebTorrent) {
        setTimeout(run, 200);
        return;
      }

      const parsedMagnet = parseMagnet(magnetURI);
      if (!parsedMagnet || parsedMagnet.trackers.length === 0) {
        setError("Invalid Magnet-URI provided.");
        return;
      }

      const localClient = await getWebTorrentClient();
      if (cancelled) return;

      if (!hasStreamingServer(localClient)) {
        setError(
          "Streaming is unavailable: the service worker could not start (needs HTTPS or localhost). Use the source link instead.",
        );
        return;
      }

      // The session owns the torrent. Three components call this hook and the
      // WebTorrent client is a singleton, so adding here per component is what
      // produced "Cannot add duplicate torrent": the add is keyed by infohash
      // instead, and `force` is the retry button rebuilding the same hash.
      const session = await openTorrentSession(localClient, {
        infoHash: parsedMagnet.infoHash,
        magnet: updateMagnetURI(magnetURI),
        announce: TRACKERS,
        force: retryCount > 0,
      });
      if (cancelled) return;

      torrent = session.torrent;

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

      const onReady = () => {
        clearTimeout(readyTimeout);
        setError(undefined);
        showPlaylist();
      };

      if (torrent.ready) {
        clearTimeout(readyTimeout);
        setError(undefined);
        showPlaylist();
      } else {
        torrent.on("ready", onReady);
      }

      const onError = (err: any) => {
        if (cancelled) return;
        console.error("Torrent error:", err?.message || err);
        setError("Torrent error: " + (err?.message || err));
      };
      const onDownload = () => {
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
      };
      const onWire = () => {
        if (cancelled) return;
        setTorrentInfo((prev) =>
          prev ? { ...prev, peers: torrent.numPeers } : prev,
        );
      };

      torrent.on("error", onError);
      torrent.on("download", onDownload);
      torrent.on("wire", onWire);

      // Listeners are ours; the torrent is not. It outlives this mount so a
      // second consumer of the hook — or coming back to this screen — finds it
      // already running instead of asking the client to add it again.
      detach = () => {
        torrent.off("ready", onReady);
        torrent.off("error", onError);
        torrent.off("download", onDownload);
        torrent.off("wire", onWire);
      };
    };

    run();

    return () => {
      cancelled = true;
      if (readyTimeout) clearTimeout(readyTimeout);
      detach?.();
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
