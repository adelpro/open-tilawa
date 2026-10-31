import { SURAH_NAMES_EN } from '@/i18n/surah-names-en';
import { surahById } from '@/constants/surah';

/**
 * A surah's name in the language being read.
 *
 * Arabic is the catalogue's own name; English is the romanisation, and it falls back to
 * the Arabic one rather than inventing a translation. The prerender step and the screen
 * both call this, so a page and the tab it opens cannot disagree about what surah 18 is
 * called.
 */
export function surahName(id: number, locale: 'ar' | 'en'): string {
  const arabic = surahById(id)?.name ?? '';
  if (locale === 'ar') return arabic;
  return SURAH_NAMES_EN[id] ?? arabic;
}
