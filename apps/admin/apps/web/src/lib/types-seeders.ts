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
   * The node this console runs, recognised by its URL host matching
   * SEEDER_SERVICE. Pinned to the top: if it is down the site is down.
   */
  pinned: boolean;
  updateMode: 'build' | 'pull';
  /** The version the deployment says this node should run. */
  desiredVersion: string | null;
  /** True while a software update is running on this host. */
  updating: boolean;
  /** The last update's failure, kept until the next one starts. */
  updateError: string | null;
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

/**
 * One connected peer. `address` is a masked prefix — the node never sends a
 * whole one — and is null when no address could be masked, as is common for a
 * WebRTC peer.
 */
export interface SeederPeer {
  type: 'web' | 'tcp' | 'other';
  direction: 'in' | 'out' | null;
  address: string | null;
  uploadSpeed: number;
  downloadSpeed: number;
  uploaded: number;
  downloaded: number;
}

export interface SeederPeerGroup {
  infoHash: string;
  name: string;
  total: number;
  web: number;
  /** TCP and uTP: the same BitTorrent peer over two socket kinds. */
  tcp: number;
  inbound: number;
  outbound: number;
  truncated: boolean;
  peers: SeederPeer[];
}

/** A live snapshot: read when the screen opens, never kept. */
export interface SeederPeers {
  total: number;
  web: number;
  tcp: number;
  inbound: number;
  outbound: number;
  torrents: SeederPeerGroup[];
}

/** Why a node will be left alone by a catalogue push. */
export type PushSkipReason = 'offline' | 'no_credentials' | 'low_space' | 'unreachable';

/**
 * What a push would do to one node, computed server-side from a live inventory.
 * The screen shows this before the operator confirms, so the numbers on the
 * button's dialog are the numbers the run will act on.
 */
export interface PushNodePlan {
  seederId: number;
  name: string;
  url: string;
  /** Published reciters the node does not hold; these are what an apply adds. */
  toAdd: { infohash: string; name: string }[];
  /** Catalogue entries the node already carries. */
  present: number;
  skipReason: PushSkipReason | null;
  /** Reciters left out because they would pass 90% of the node's quota. */
  skipped: number;
  capBytes: number | null;
  detail: string | null;
}

export interface PushPlan {
  catalogue: number;
  nodes: PushNodePlan[];
}
