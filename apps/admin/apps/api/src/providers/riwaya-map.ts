/**
 * A provider's reading name, mapped onto the catalogue's vocabulary.
 *
 * The catalogue stores a small closed set; providers write free text in two
 * languages (`Hafs an Aasim`, `Rewayat Hafs A'n Assem - Murattal`, `حفص عن
 * عاصم`). Anything that names no listed reading is `unknown`: a wrong riwaya is
 * worse than an honest gap.
 */
const PATTERNS: { match: RegExp; value: string }[] = [
  { match: /حفص|\bhafs\b/i, value: 'Hafs' },
  { match: /ورش|\bwarsh\b/i, value: 'Warsh' },
  { match: /قالون|\bqal[ou]n\b/i, value: 'Qalon' },
  { match: /الدوري|\bdouri\b|\bduri\b/i, value: 'al-Douri' },
  { match: /شعبة|\bshu.?bah\b/i, value: 'Shubah an asim' },
];

/** Lowercase, strip Arabic diacritics, and collapse punctuation to spaces. */
function normalise(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function mapRiwaya(name: string | null | undefined): string {
  const text = normalise((name ?? '').toString());
  if (!text) return 'unknown';
  for (const rule of PATTERNS) {
    if (rule.match.test(text)) return rule.value;
  }
  return 'unknown';
}
