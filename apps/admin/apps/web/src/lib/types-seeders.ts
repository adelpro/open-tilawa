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
