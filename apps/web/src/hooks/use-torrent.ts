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
import { openTorrentSession } from "@/utils/torrent-session";
import { mediaBase, shouldAddWebSeed } from "@/utils/webseed";

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
    if (!magnetURI) {
      setError('This reciter has no magnet. Publish it from the catalogue.');
      return;
    }

    let cancelled = false;
    let torrent: any = null;
    let readyTimeout: ReturnType<typeof setTimeout>;
    let detach: (() => void) | undefined;
    /** Set once the grace period has passed with nobody answering. */
    let webSeedAdded = false;
    let readyAt = 0;
    let webSeedTimer: ReturnType<typeof setInterval> | undefined;

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
            return { surahId, file };
          })
          .sort((a: TrackType, b: TrackType) => a.surahId - b.surahId);
        setTorrentInfo({
          name: torrent.name,
          magnetURI: torrent.magnetURI,
          downloaded: torrent.downloaded,
          downloadSpeed: torrent.downloadSpeed,
          uploadSpeed: torrent.uploadSpeed,
          progress: torrent.progress,
          peers: torrent.numPeers,
          webSeed: webSeedAdded ? 'active' : 'off',
          files,
          ready: true,
        });
      };

      /**
       * Nobody is answering: give the torrent an HTTP source of its own.
       *
       * The audio element is never touched — this only adds a peer-like source,
       * so the pieces it delivers are verified and seeded like any other.
       */
      const maybeAddWebSeed = () => {
        if (cancelled || webSeedAdded || !torrent.ready) return;
        if (torrent.numPeers > 0) {
          readyAt = Date.now();
          return;
        }
        if (!readyAt) readyAt = Date.now();
        const waitedMs = Date.now() - readyAt;
        if (
          !shouldAddWebSeed({
            ready: torrent.ready,
            peers: torrent.numPeers,
            progress: torrent.progress,
            waitedMs,
            alreadyAdded: webSeedAdded,
          })
        )
          return;
        try {
          torrent.addWebSeed(mediaBase(window.location.origin));
          webSeedAdded = true;
          setTorrentInfo((prev) => (prev ? { ...prev, webSeed: 'active' } : prev));
        } catch (err) {
          console.warn('web seed rejected', err);
        }
      };

      const startWebSeedWatch = () => {
        if (webSeedTimer) return;
        readyAt = Date.now();
        webSeedTimer = setInterval(maybeAddWebSeed, 1_000);
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
        startWebSeedWatch();
      };

      if (torrent.ready) {
        clearTimeout(readyTimeout);
        setError(undefined);
        showPlaylist();
        startWebSeedWatch();
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
      if (webSeedTimer) clearInterval(webSeedTimer);
      detach?.();
    };
  }, [magnetURI, webtorrentReady, retryCount]);

  return {
    torrentInfo,
    error,
    setError,
    retry: () => setRetryCount((c) => c + 1),
  };
}
