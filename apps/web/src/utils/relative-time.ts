/**
 * How long ago, as a unit and a count, with no words.
 *
 * The copy lives in the locale files, because Arabic agrees the noun with the
 * number (يوم، يومين، أيام) and a formatter that returns "3 day ago" cannot be
 * fixed from the outside. The thresholds are the ones a person would use
 * speaking: seconds are "now", days stop at a week, months at a year.
 */
export type RelativeUnit = 'now' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export type Relative = { unit: RelativeUnit; value: number };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function relativeTime(ts: number, now: number = Date.now()): Relative {
  // A clock that jumped, or a row written by a device whose clock is ahead:
  // "in 3 minutes" is worse than "now".
  if (!Number.isFinite(ts)) return { unit: 'now', value: 0 };
  const diff = Math.max(0, now - ts);

  if (diff < 45_000) return { unit: 'now', value: 0 };
  if (diff < HOUR) return { unit: 'minute', value: Math.max(1, Math.floor(diff / MINUTE)) };
  if (diff < DAY) return { unit: 'hour', value: Math.floor(diff / HOUR) };
  if (diff < WEEK) return { unit: 'day', value: Math.floor(diff / DAY) };
  if (diff < MONTH) return { unit: 'week', value: Math.floor(diff / WEEK) };
  if (diff < YEAR) return { unit: 'month', value: Math.floor(diff / MONTH) };
  return { unit: 'year', value: Math.floor(diff / YEAR) };
}
