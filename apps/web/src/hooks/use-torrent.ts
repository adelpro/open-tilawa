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
    /** The last moment the torrent delivered verified bytes. */
    let lastByteAt = 0;
    /** WebTorrent says no piece is selected: the player is not waiting on data. */
    let idle = false;
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
          "Streaming is unavailable: the service worker could not start (needs HTTPS or localhost).",
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

      /**
       * Peers a listener is actually sharing with. A web seed is a peer to
       * WebTorrent, so counting it would report "1 peer" with nobody else in the
       * swarm — and would make the stream read as "mixed" the moment the
       * fallback was added.
       */
      const realPeers = () =>
        ((torrent.wires as { type?: string }[] | undefined) ?? []).filter(
          (wire) => wire.type !== 'webSeed',
        ).length;

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
          peers: realPeers(),
          webSeed: webSeedAdded ? 'active' : 'off',
          files,
          ready: true,
        });
      };

      /**
       * Nothing is arriving: give the torrent an HTTP source of its own.
       *
       * The audio element is never touched — this only adds a peer-like source,
       * so the pieces it delivers are verified and seeded like any other.
       *
       * The trigger is silence, not an empty swarm: a connected peer that sends
       * nothing is exactly the stall this is for, and WebTorrent offers no way
       * to take the seed back afterwards.
       */
      const maybeAddWebSeed = () => {
        if (cancelled || webSeedAdded || !torrent.ready) return;
        if (
          !shouldAddWebSeed({
            ready: torrent.ready,
            idle,
            stalledMs: Date.now() - lastByteAt,
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
        lastByteAt = Date.now();
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
        lastByteAt = Date.now();
        idle = false;
        setTorrentInfo((prev) =>
          prev
            ? {
                ...prev,
                downloaded: torrent.downloaded,
                downloadSpeed: torrent.downloadSpeed,
                uploadSpeed: torrent.uploadSpeed,
                progress: torrent.progress,
                peers: realPeers(),
              }
            : prev,
        );
      };
      const onWire = () => {
        if (cancelled) return;
        setTorrentInfo((prev) =>
          prev ? { ...prev, peers: realPeers() } : prev,
        );
      };
      /** Demand resumed after a buffer: the swarm gets its grace period again. */
      const onInterested = () => {
        if (cancelled) return;
        idle = false;
        lastByteAt = Date.now();
      };
      /** Nothing selected: silence here is a paused player, not a stall. */
      const onIdle = () => {
        if (cancelled) return;
        idle = true;
      };

      torrent.on("error", onError);
      torrent.on("download", onDownload);
      torrent.on("wire", onWire);
      torrent.on("interested", onInterested);
      torrent.on("idle", onIdle);

      // Listeners are ours; the torrent is not. It outlives this mount so a
      // second consumer of the hook — or coming back to this screen — finds it
      // already running instead of asking the client to add it again.
      detach = () => {
        torrent.off("ready", onReady);
        torrent.off("error", onError);
        torrent.off("download", onDownload);
        torrent.off("wire", onWire);
        torrent.off("interested", onInterested);
        torrent.off("idle", onIdle);
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
