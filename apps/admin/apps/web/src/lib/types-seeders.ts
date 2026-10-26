export interface Seeder {
  id: number;
  name: string;
  url: string;
  status: 'online' | 'offline';
  lastSeen: string | null;
  torrentCount: number;
  peerCount: number;
  uploadSpeed: number;
  downloadSpeed: number;
  /** True when Basic-auth credentials are stored; the password never leaves the API. */
  hasCredentials: boolean;
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
