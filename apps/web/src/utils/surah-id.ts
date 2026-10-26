import type { TrackType } from '@/types';

/**
 * The surah a file plays. Filenames are not trustworthy (`ar_Name_001.mp3`),
 * so the parsed id wins and the position is only a fallback.
 */
export function surahIdOf(track: TrackType | undefined, index: number): number {
  if (!track) return index + 1;
  return track.surahId > 0 ? track.surahId : index + 1;
}
