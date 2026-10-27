/**
 * `Maher_Al-Muaiqly_(Update2)_(MP3_Quran)` → `Maher Al Muaiqly`.
 *
 * Only a fallback: the catalogue's Arabic name is what the list shows. This is
 * for a row nobody has named yet.
 */
export function cleanTorrentName(raw: string): string {
  return raw
    .replace(/^the holy quran mp3 recited by\s+/i, '')
    .replace(/\((?:mp3[_\s]?quran|update\s*\d*)\)/gi, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
