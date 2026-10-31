/**
 * The roster's reading order.
 *
 * The catalogue serves rows in the order a human published them, which is an
 * editorial order, not an order a listener can predict. Names sort by ICU's
 * Arabic collation instead: hamza forms stay with their alif (أ إ آ ا), ة sits
 * with ه, ى with ي, and one shared collator keeps every surface — the sheet, the
 * page and the prerendered HTML — agreeing to the letter.
 *
 * Pure, so it runs under `node --test` and inside the prerender script.
 */

/** Built once: constructing a collator per comparison is the expensive part. */
const ARABIC = new Intl.Collator('ar', { numeric: true });

/** Rows in reading order, leaving the caller's array untouched. */
export function sortByArabicName<T>(rows: T[], nameOf: (row: T) => string): T[] {
  return [...rows].sort((a, b) => ARABIC.compare(nameOf(a), nameOf(b)));
}
