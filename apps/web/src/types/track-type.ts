/**
 * One surah inside a release. There is no `link`: playback is always the
 * service-worker stream, and the HTTP fallback is a web seed on the torrent.
 */
export type TrackType = {
  surahId: number;
  file?: any;
};
