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

/**
 * The windows the screen offers, and the id each one stores.
 *
 * The chosen window is a browser preference (see tab-memory), and localStorage
 * holds text, so an id is the day count written out: "7", "30", "90", "365". Keeping
 * the list here — next to the window maths — means the button row, the stored
 * value and the header can never disagree about which ranges exist.
 */
export const USAGE_RANGES = [7, 30, 90, 365] as const;

export type UsageRange = (typeof USAGE_RANGES)[number];

export const USAGE_RANGE_IDS = USAGE_RANGES.map((days) => String(days) as `${UsageRange}`);

export const DEFAULT_USAGE_RANGE: UsageRange = 7;

/** A stored id as the window it names; an id this build dropped is the default. */
export function parseUsageRange(id: string): UsageRange {
  return USAGE_RANGES.find((days) => `${days}` === id) ?? DEFAULT_USAGE_RANGE;
}

/**
 * The next wider window, or null at the widest one.
 *
 * The empty state offers a single click out of a window that reported nothing, so
 * the button never has to decide which range to offer: it is the next entry in
 * `USAGE_RANGES`, and the list is already the one place that knows them.
 */
export function nextRange(days: UsageRange): UsageRange | null {
  const index = USAGE_RANGES.indexOf(days);
  return index === -1 ? null : (USAGE_RANGES[index + 1] ?? null);
}

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
