import { MagnetlinkSource, Riwaya } from '@/types';

export type ReciterTag =
  | 'p2p'
  | 'mp3'
  | 'web-seed'
  | 'http-fallback'
  | 'p2p-only'
  | 'archive.org'
  | 'mp3quran.net'
  | 'islamhouse.com';

export type Reciter = {
  id: number;
  name: string;
  riwaya: Riwaya;
  magnet: string;
  source: MagnetlinkSource;
  complet: boolean;
  tags?: ReciterTag[];
};
