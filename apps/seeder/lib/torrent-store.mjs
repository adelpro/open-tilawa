import { existsSync, writeFileSync } from 'node:fs';

/**
 * What is loaded, written down — the one guarantee a restart needs.
 *
 * The boot scan rebuilds the swarm from `TORRENT_DIR`, so anything loaded in
 * memory that has no file there is lost the moment the process is replaced: by an
 * update, a `docker stop`, or a crash. Persisting at add time covers the normal
 * path; this covers everything that slipped past it, which is what an update must
 * do before it recreates the container.
 */

/** `<dir>/<infohash>.torrent`, or null when the hash is not a v1 infohash. */
export function torrentFilePath(dir, infoHash) {
  const hash = String(infoHash ?? '').toLowerCase();
  // The hash becomes a filename, so it has to be a hash and nothing else.
  if (!/^[0-9a-f]{40}$/.test(hash)) return null;
  return `${dir}/${hash}.torrent`;
}

/**
 * Write a `.torrent` for every loaded torrent that does not already have one on
 * disk. Returns the paths written, so the caller can say what it did.
 *
 * `sourceFiles` is the node's hash → file map; an entry there that still exists
 * counts as durable, even when the file is not named after the hash (curated
 * releases are not).
 */
export function saveMissingTorrents(dir, torrents = [], sourceFiles = new Map()) {
  const written = [];
  for (const torrent of Array.isArray(torrents) ? torrents : []) {
    const known = torrent?.infoHash ? sourceFiles.get(torrent.infoHash) : null;
    if (known && existsSync(known)) continue;
    const target = torrentFilePath(dir, torrent?.infoHash);
    if (!target) continue;
    const body = torrent?.torrentFile;
    // A torrent without metadata yet has nothing to write; it will be picked up
    // by the next pass rather than stored as an empty file.
    if (!body || body.length === 0) continue;
    writeFileSync(target, body);
    sourceFiles.set(torrent.infoHash, target);
    written.push(target);
  }
  return written;
}
