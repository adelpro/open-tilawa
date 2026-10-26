import type { MagnetlinkSource } from "@/types";

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
  /** From the catalogue; the static list leaves it out. */
  riwaya?: string;
  /** Direct Itqan MP3 URLs per surah — HTTP fallback when no torrent exists yet. */
  itqanPlaylist?: ItqanTrack[];
};
