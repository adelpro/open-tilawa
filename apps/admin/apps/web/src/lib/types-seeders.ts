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
  status: 'online' | 'offline';
  lastSeen: string | null;
  realm: string | null;
}
