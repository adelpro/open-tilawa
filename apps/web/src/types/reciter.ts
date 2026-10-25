import { MagnetlinkSource } from "@/types";

export type ItqanTrack = {
  surahId: number;
  link: string;
};

export type Reciter = {
  id: number;
  name: string;
  magnet: string;
  source: MagnetlinkSource;
  complet: boolean;
  /** Direct Itqan MP3 URLs per surah — HTTP fallback when no torrent exists yet. */
  itqanPlaylist?: ItqanTrack[];
};
