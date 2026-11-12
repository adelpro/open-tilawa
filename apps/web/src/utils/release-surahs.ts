import { SURAHS } from '@/constants/surah';
import type { Surah } from '@/types/surah';

/**
 * The surahs one release actually carries.
 *
 * `surahs` is the manifest the import wrote from the provider's track list. Null
 * (a row that predates the column, or a torrent entered by hand) means the
 * catalogue does not know, and the whole book stays the answer: hiding a real
 * surah is worse than offering one, and the player's own file check still refuses
 * a surah that is not in the torrent.
 */
export function surahsForRelease(surahs: number[] | null | undefined): Surah[] {
  if (!Array.isArray(surahs) || surahs.length === 0) return SURAHS;
  const carried = new Set(surahs);
  return SURAHS.filter((surah) => carried.has(surah.id));
}

/**
 * Where to resume a release: the wanted surah when it carries it, otherwise its
 * first. A stored playhead can name a surah from another release, and a partial
 * one would open on a file that is not there.
 */
export function surahInRelease(wanted: number, surahs: number[] | null | undefined): number {
  if (!Array.isArray(surahs) || surahs.length === 0 || surahs.includes(wanted)) return wanted;
  return [...surahs].sort((a, b) => a - b)[0];
}

/**
 * The next surah that can actually play. A sparse release is stepped, not
 * incremented: from Al-Fatihah the next file is 18, and after the last one the
 * transport stops instead of opening a missing file. An unknown manifest keeps
 * the old arithmetic, with `selectSurah`'s own 1..114 guard as the edge.
 */
export function nextSurahInRelease(
  current: number,
  surahs: number[] | null | undefined,
): number | null {
  if (!Array.isArray(surahs) || surahs.length === 0) return current + 1;
  return [...surahs].sort((a, b) => a - b).find((id) => id > current) ?? null;
}

/** The mirror of `nextSurahInRelease`, for the back button. */
export function previousSurahInRelease(
  current: number,
  surahs: number[] | null | undefined,
): number | null {
  if (!Array.isArray(surahs) || surahs.length === 0) return current - 1;
  return [...surahs].sort((a, b) => b - a).find((id) => id < current) ?? null;
}
