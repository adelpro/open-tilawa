export interface Seeder {
  id: number;
  name: string;
  url: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  torrentCount: number;
  peerCount: number;
  uploadSpeed: number;
  downloadSpeed: number;
  /** True when Basic-auth credentials are stored; the password never leaves the API. */
  hasCredentials: boolean;
  /** Seeder release reported by its /health. */
  version: string | null;
  /** Build SHA stamped into the node's image. */
  sha: string | null;
  /** Disk space on the node's data volume. */
  freeBytes: number | null;
  totalBytes: number | null;
  /** Operator cap on the node (0 = unlimited). */
  quotaBytes: number | null;
  /** What the node holds, by torrent length. */
  usedBytes: number | null;
  /** How much more it will accept right now (quota and disk combined). */
  headroomBytes: number | null;
  /**
   * The node this dashboard runs, recognised by its URL host matching
   * SEEDER_SERVICE. Pinned to the top: if it is down the site is down.
   */
  pinned: boolean;
  updateMode: 'build' | 'pull';
  /** The version the deployment says this node should run. */
  desiredVersion: string | null;
}

export interface Turn {
  id: number;
  name: string;
  url: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  /** Last successful STUN round trip, milliseconds. */
  latencyMs: number | null;
}

export interface TurnCheck {
  checkedAt: string;
  ok: boolean;
  latencyMs: number | null;
  detail: string | null;
}

export interface SeederTorrent {
  name: string;
  infoHash: string;
  size: number;
  progress: string;
  peers: number;
  uploadSpeed: number;
  downloadSpeed: number;
  uploaded: number;
  downloaded: number;
  files: number;
  done: boolean;
}

export interface SeederInventory {
  torrents: SeederTorrent[];
  stats: {
    totalTorrents: number;
    totalPeers: number;
    uploadSpeed: number;
    downloadSpeed: number;
  };
}
