/**
 * What a window of daily counters adds up to.
 *
 * The counters are per day: `device_days` and `listener_days` hold one row each
 * for a day, and no row names a device. So a range total would count the same
 * phone once for every day it opened the app, and this module never produces
 * one. What it can say honestly is how many days reported, which day was the
 * busiest, the average of the days that did report, and the newest report —
 * which is often not today.
 */

export type CountedDay = { day: string; count: number };

export type PeriodStats = {
  /** Days that reported a device at all; a stored zero is not a report. */
  days: number;
  /** The busiest day, earliest when two tie. */
  best: CountedDay | null;
  /** Devices per reporting day, not per calendar day. */
  average: number;
  /** The newest day that reported. */
  latest: CountedDay | null;
};

export function periodStats(rows: readonly CountedDay[]): PeriodStats {
  const reported = rows.filter((row) => Number.isFinite(row.count) && row.count > 0);
  if (reported.length === 0) return { days: 0, best: null, average: 0, latest: null };

  let best = reported[0];
  let latest = reported[0];
  let sum = 0;

  for (const row of reported) {
    sum += row.count;
    if (row.count > best.count || (row.count === best.count && row.day < best.day)) best = row;
    if (row.day > latest.day) latest = row;
  }

  return {
    days: reported.length,
    best,
    average: Math.round((sum / reported.length) * 10) / 10,
    latest,
  };
}
