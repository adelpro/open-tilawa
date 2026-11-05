export interface QfNamed {
  name: string;
  language_name?: string;
}

export interface QfChapterReciter {
  id: number;
  name: string;
  style: QfNamed | null;
  qirat: QfNamed | null;
  translated_name?: QfNamed | null;
}

export interface QfListResponse {
  reciters: QfChapterReciter[];
}

export interface QfAudioFile {
  id: number;
  chapter_id: number;
  file_size: number;
  format: string;
  audio_url: string;
}

export interface QfAudioResponse {
  audio_files: QfAudioFile[];
}

export interface QfTokenResponse {
  access_token: string;
  expires_in: number;
}
