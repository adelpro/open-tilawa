/**
 * Arabic counts agree with the noun by number, and `آية` is one of the words
 * where the wrong form is immediately visible: 7 آيات but 286 آية, and two of
 * them are آيتان, not "2 آية".
 */
export function ayahCountLabel(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return 'آيات';
  if (count === 1) return 'آية واحدة';
  if (count === 2) return 'آيتان';
  if (count <= 10) return `${count} آيات`;
  return `${count} آية`;
}
