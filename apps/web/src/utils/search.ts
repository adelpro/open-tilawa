import { SURAHS } from '@/constants/surah';
import type { Reciter } from '@/types';

/**
 * Arabic search has to survive what people actually type: without hamza
 * (`الانفال` for `الأنفال`), without tashkeel, with `ه` for `ة`, and with either
 * digit set. Normalising both sides is cheaper and more forgiving than a
 * fuzzy-match library, and the lists are 114 and 20 rows long.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // tashkeel and tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True when every token of the query appears in at least one haystack. */
export function matchesQuery(haystacks: (string | number)[], query: string): boolean {
  const tokens = normalizeArabic(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;

  const hay = haystacks.map((value) => normalizeArabic(String(value)));
  return tokens.every((token) => hay.some((value) => value.includes(token)));
}

export type SurahRow = (typeof SURAHS)[number];

export function filterSurahs(query: string, rows: SurahRow[] = SURAHS): SurahRow[] {
  if (!query.trim()) return rows;
  return rows.filter((surah) => matchesQuery([surah.name, surah.id], query));
}

export function filterReciters(query: string, rows: Reciter[]): Reciter[] {
  if (!query.trim()) return rows;
  return rows.filter((reciter) => matchesQuery([reciter.name, reciter.riwaya], query));
}
