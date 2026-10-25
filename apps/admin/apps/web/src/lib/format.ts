/**
 * The fine-print layer: timestamps and durations.
 *
 * Everything goes through `Intl` rather than string arithmetic, because "12 Mar 2026"
 * is an English sentence, not a date. Two deliberate choices:
 *
 * - The Arabic tag is `ar-u-nu-latn`: the interface shows Latin digits everywhere, so a
 *   date reading ٢٠٢٦ in one place and 2026 in another would look like a bug. Month
 *   names are still Arabic, which is the part that actually needs translating.
 * - Formatters are cached. `Intl.DateTimeFormat` construction is the expensive part,
 *   and these run once per table row.
 */
export type FmtLocale = 'en' | 'ar';

const TAG: Record<FmtLocale, string> = {
  en: 'en-GB',
  ar: 'ar-u-nu-latn',
};

const dateFormat = new Map<FmtLocale, Intl.DateTimeFormat>();
const relativeFormat = new Map<FmtLocale, Intl.RelativeTimeFormat>();

function dateFormatter(locale: FmtLocale): Intl.DateTimeFormat {
  let formatter = dateFormat.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(TAG[locale], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    dateFormat.set(locale, formatter);
  }
  return formatter;
}

function relativeFormatter(locale: FmtLocale): Intl.RelativeTimeFormat {
  let formatter = relativeFormat.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(TAG[locale], { numeric: 'auto', style: 'short' });
    relativeFormat.set(locale, formatter);
  }
  return formatter;
}

export function shortDate(iso: string | null | undefined, locale: FmtLocale = 'en'): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter(locale).format(date);
}

export function relative(iso: string | null | undefined, locale: FmtLocale = 'en'): string {
  if (!iso) return never(locale);
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return never(locale);
  const seconds = Math.round((Date.now() - then) / 1000);
  const formatter = relativeFormatter(locale);
  if (seconds < 60) return formatter.format(-0, 'second');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return formatter.format(-days, 'day');
  return shortDate(iso, locale);
}

/** The one word `relative` cannot produce, because it is not a relative time. */
function never(locale: FmtLocale): string {
  return locale === 'ar' ? 'أبدًا' : 'never';
}

export function duration(ms: number | null | undefined, locale: FmtLocale = 'en'): string {
  if (ms === null || ms === undefined) return '—';
  const number = new Intl.NumberFormat(TAG[locale], { maximumFractionDigits: 1 });
  return ms < 1000 ? `${number.format(Math.round(ms))} ms` : `${number.format(ms / 1000)} s`;
}
