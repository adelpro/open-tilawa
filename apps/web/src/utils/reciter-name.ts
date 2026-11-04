import type { Locale } from '@/i18n/messages';

/**
 * `Maher_Al-Muaiqly_(Update2)_(MP3_Quran)` → `Maher Al Muaiqly`.
 *
 * Only a fallback: the catalogue's Arabic name is what the Arabic screen shows. This is
 * for a row nobody has named yet, and for the English label of a row that has one.
 */
export function cleanTorrentName(raw: string): string {
  return raw
    .replace(/^the holy quran mp3 recited by\s+/i, '')
    .replace(/\((?:mp3[_\s]?quran|update\s*\d*)\)/gi, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * The name a listener reads, in the language they chose.
 *
 * Reciter names are proper names: Arabic keeps the catalogue's `nameAr`, English uses
 * the release's own latin name. The fallback matters for rows published before the
 * catalogue carried latin names, and for a cached roster from an older release.
 */
export function reciterName(
  reciter: { name: string; nameEn?: string },
  locale: Locale,
): string {
  if (locale === 'ar') return reciter.name;
  return reciter.nameEn?.trim() || reciter.name;
}
