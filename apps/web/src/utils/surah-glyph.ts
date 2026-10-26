/**
 * QUL's surah-name font draws each name as one glyph, mapped to the private-use
 * block starting at U+E900: surah 1 is U+E900, surah 114 is U+E971.
 *
 * The glyph is decoration; the real name stays in the markup for screen readers
 * and for the tab title.
 */
export const SURAH_GLYPH_BASE = 0xe900;

export function surahNameGlyph(surahId: number): string {
  if (!Number.isInteger(surahId) || surahId < 1 || surahId > 114) return '';
  return String.fromCharCode(SURAH_GLYPH_BASE + surahId - 1);
}
