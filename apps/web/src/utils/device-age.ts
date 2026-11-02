/**
 * How old this device is, as a range the server can count.
 *
 * The consent promise is that no identifier links one day to the next. This keeps
 * it: the first-open date stays in this browser, and the event carries only the
 * range it falls in. The server can say "four of today's seven devices first
 * opened the app a week ago or more" without being able to say which four.
 *
 * The ranges widen with age on purpose: a day-one device is the interesting one,
 * and a month-old device is only interesting as "not new".
 */
export const AGE_BUCKETS = ['new', '1-3', '4-6', '7-13', '14-29', '30+'] as const;

export type AgeBucket = (typeof AGE_BUCKETS)[number];

/** Whole UTC days between two `YYYY-MM-DD` strings; 0 for anything unreadable. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function ageBucket(days: number): AgeBucket {
  if (!Number.isFinite(days) || days <= 0) return 'new';
  if (days <= 3) return '1-3';
  if (days <= 6) return '4-6';
  if (days <= 13) return '7-13';
  if (days <= 29) return '14-29';
  return '30+';
}

/** The buckets that count as "came back a week later" on the console. */
export const RETURNING_BUCKETS: ReadonlySet<AgeBucket> = new Set(['7-13', '14-29', '30+']);
