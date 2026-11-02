import type { TrackType } from './track-type';

export type TorrentInfo = {
  /** The release's own folder name. `/media/<name>/<file>` is the web seed path. */
  name: string;
  magnetURI: string;
  files: TrackType[];
  downloaded: number;
  downloadSpeed: number;
  uploadSpeed: number;
  progress: number;
  peers: number;
  /** `active` once this torrent also pulls from the `/media` web seed. */
  webSeed: 'off' | 'active';
  /** True when `file.streamURL` can answer: the service worker created a server. */
  streaming: boolean;
  ready: boolean;
};
