/**
 * Pure parts of the Itqan import, kept out of the network code so they can be
 * tested without an API key or 2 GB of downloads.
 */

/** The seeder's files are named after the surah, like every other release. */
export function trackFileName(surahNumber) {
  return `${String(surahNumber).padStart(3, '0')}.mp3`;
}

export function totalBytes(tracks) {
  return tracks.reduce((sum, track) => sum + (Number(track.size_bytes) || 0), 0);
}

/** A resumed import trusts the bytes already on disk only when they match. */
export function shouldSkip(existingBytes, expectedBytes) {
  return (
    Number.isFinite(existingBytes) &&
    existingBytes > 0 &&
    Number.isFinite(expectedBytes) &&
    expectedBytes > 0 &&
    existingBytes === expectedBytes
  );
}

/** It becomes a URL path segment and a folder name, so keep it boring. */
export function validFolderName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name);
}

/**
 * What to do with a folder that already exists.
 *
 * Overwriting bytes inside a folder a live torrent is seeding makes that node
 * upload pieces that no longer match its hashes. So a non-empty folder is
 * refused unless the operator explicitly asks to resume an interrupted import.
 */
export function importDecision(entryCount, resume) {
  if (!Number.isFinite(entryCount) || entryCount <= 0) return 'start';
  return resume ? 'resume' : 'refuse';
}
