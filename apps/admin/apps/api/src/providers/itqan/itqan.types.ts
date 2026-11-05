export interface ItqanRecitation {
  id: number;
  name: string;
  reciter: { id: number; name: string };
  riwayah: { id: number; name: string } | null;
  surahs_count: number;
  folders?: { name: string; slug: string; is_default: boolean }[];
}

export interface ItqanListResponse {
  count: number;
  results: ItqanRecitation[];
}

export interface ItqanTrack {
  surah_number: number;
  surah_name: string;
  audio_url: string;
  size_bytes: number;
}

export interface ItqanDetailResponse {
  count: number;
  results: ItqanTrack[];
}
