export interface Mp3QuranMoshaf {
  id: number;
  name: string;
  rewaya_id?: number;
  server: string;
  surah_total: number;
  surah_list: string;
  moshaf_type?: number;
}

export interface Mp3QuranReciter {
  id: number;
  name: string;
  letter?: string;
  moshaf: Mp3QuranMoshaf[];
}

export interface Mp3QuranResponse {
  reciters: Mp3QuranReciter[];
}
