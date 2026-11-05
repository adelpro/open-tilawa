import fs from 'node:fs';
import path from 'node:path';
import Semaphore from '../utils/semaphore.js';
import TRACKERS from '../constants/TRACKERS.js';

export { trackFileName } from './itqan.mjs';

const FULL_QURAN = 114;

/** Every import is a whole mushaf: 114 distinct surahs, each an http(s) URL. */
export function validateTracks(tracks) {
  if (!Array.isArray(tracks) || tracks.length !== FULL_QURAN) {
    return { ok: false, error: `expected ${FULL_QURAN} tracks` };
  }
  const seen = new Set();
  for (const track of tracks) {
    if (!Number.isInteger(track?.surah) || track.surah < 1 || track.surah > FULL_QURAN) {
      return { ok: false, error: `invalid surah number: ${track?.surah}` };
    }
    if (seen.has(track.surah)) return { ok: false, error: `duplicate surah ${track.surah}` };
    seen.add(track.surah);
    let url;
    try {
      url = new URL(track.url);
    } catch {
      return { ok: false, error: `invalid URL for surah ${track.surah}` };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: `surah ${track.surah} is not an http(s) URL` };
    }
    if (
      track.sizeBytes !== null &&
      track.sizeBytes !== undefined &&
      (!Number.isFinite(track.sizeBytes) || track.sizeBytes < 0)
    ) {
      return { ok: false, error: `invalid size for surah ${track.surah}` };
    }
  }
  return { ok: true };
}

export function sumBytes(tracks) {
  return tracks.reduce((total, track) => total + (Number(track.sizeBytes) || 0), 0);
}

/**
 * MP3Quran publishes no sizes, so the pre-download disk check needs a floor.
 * A known sum wins; otherwise the operator's estimate is the number to beat.
 */
export function estimateBytes(tracks, fallback) {
  const known = sumBytes(tracks);
  return known > 0 ? known : fallback;
}

/**
 * Download one release into `dir`. A resume is safe only when the existing file
 * has exactly the declared size; a partial file is fetched again.
 */
export async function downloadTracks({
  dir,
  tracks,
  concurrency = 3,
  onProgress,
  isCancelled = () => false,
  freeBytes,
  reserveBytes = 0,
}) {
  fs.mkdirSync(dir, { recursive: true });
  const semaphore = new Semaphore(concurrency);
  let done = 0;
  let bytes = 0;

  const report = () => onProgress?.(done, tracks.length, bytes);

  await Promise.all(
    tracks.map(async (track) => {
      const file = path.join(dir, `${String(track.surah).padStart(3, '0')}.mp3`);
      const existing = fs.existsSync(file) ? fs.statSync(file).size : null;
      if (existing !== null && existing > 0 && existing === track.sizeBytes) {
        done += 1;
        bytes += existing;
        report();
        return;
      }

      await semaphore.acquire();
      try {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          if (isCancelled()) throw new Error('cancelled');
          const free = freeBytes?.();
          if (Number.isFinite(free) && free < reserveBytes) {
            throw new Error(`not enough free space: ${free} bytes left`);
          }
          try {
            const response = await fetch(track.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const body = Buffer.from(await response.arrayBuffer());
            if (track.sizeBytes && body.length !== track.sizeBytes) {
              throw new Error(`got ${body.length} bytes, declared ${track.sizeBytes}`);
            }
            fs.writeFileSync(file, body);
            done += 1;
            bytes += body.length;
            report();
            return;
          } catch (err) {
            if (attempt === 3) throw new Error(`${path.basename(file)}: ${err.message}`);
            await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
          }
        }
      } finally {
        semaphore.release();
      }
    }),
  );

  const actual = tracks.reduce((total, track) => {
    const file = path.join(dir, `${String(track.surah).padStart(3, '0')}.mp3`);
    return total + (fs.existsSync(file) ? fs.statSync(file).size : 0);
  }, 0);

  return { files: tracks.length, bytes: actual };
}

/**
 * Seed a folder with the node's running client and persist its .torrent. Reusing
 * the running client is why an import needs no restart: the node starts serving
 * the pieces as soon as the torrent is added.
 */
export async function seedDirectory({ client, dir, name, torrentDir }) {
  let torrent = client.torrents.find((entry) => entry.name === name);

  if (!torrent) {
    torrent = await new Promise((resolve, reject) => {
      const pending = client.seed(
        dir,
        { name, pieceLength: 2 * 1024 * 1024, announce: TRACKERS },
        () => resolve(pending),
      );
      pending.on('error', reject);
    });
  }

  fs.mkdirSync(torrentDir, { recursive: true });
  fs.writeFileSync(path.join(torrentDir, `${torrent.infoHash}.torrent`), torrent.torrentFile);

  return {
    infohash: torrent.infoHash,
    magnet: torrent.magnetURI,
    sizeBytes: torrent.length,
    fileCount: torrent.files.length,
  };
}
