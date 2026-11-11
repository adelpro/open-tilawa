/**
 * The funnel, as arithmetic only.
 *
 * Two daily counters that no query can join: `device_days` counts devices that
 * opened the app, `listener_days` counts devices that started playing. Neither
 * row names a device, so "did *this* device play?" is unanswerable by design —
 * what can be answered is how many did, per day.
 *
 * Kept out of the route so the share has one definition, and so the days the
 * two counters disagree about are handled in one place instead of in JSX.
 */

export type FunnelRow = { day: string; devices: number; listeners: number };

/**
 * Line the two series up by day, keeping every day either one reports.
 *
 * A day only the listener counter knows about is a real day: the device event
 * is a separate send and can be lost, and dropping the row would hide the only
 * evidence that anything happened.
 */
export function funnelRows(
  devices: readonly { day: string; devices: number }[],
  listeners: readonly { day: string; listeners: number }[],
): FunnelRow[] {
  const byDay = new Map<string, FunnelRow>();
  for (const row of devices) {
    byDay.set(row.day, { day: row.day, devices: row.devices, listeners: 0 });
  }
  for (const row of listeners) {
    const existing = byDay.get(row.day);
    if (existing) existing.listeners = row.listeners;
    else byDay.set(row.day, { day: row.day, devices: 0, listeners: row.listeners });
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * The share of opening devices that played, or null when there were none.
 *
 * A day with no devices has no share — not 0%, which would read as "everyone
 * left". And the counters can legitimately disagree after a storage wipe, so
 * the reading is capped at all of them: a floor, never a fiction above 100%.
 */
export function playedShare(listeners: number, devices: number): number | null {
  if (!Number.isFinite(devices) || devices <= 0) return null;
  return Math.min(1, Math.max(0, listeners / devices));
}

export type AgeRow = { day: string; age: string; devices: number };

/** The buckets that count as "came back a week later". Mirrors the client's. */
const RETURNING = new Set(['7-13', '14-29', '30+']);

/**
 * The returning share of the latest day that reported an age.
 *
 * `deviceAges` counts devices by range; a device that reported before the age
 * shipped has no row, so the denominator is the devices that did report one —
 * never `device_days`, which would silently treat "not reported" as "new".
 * Returns null on a day with no known age, so the screen can say nothing rather
 * than 0%.
 */
export function returningDevices(
  rows: readonly AgeRow[],
): { day: string; returning: number; known: number; anyReturning: boolean } | null {
  if (rows.length === 0) return null;
  const latest = rows.reduce((max, row) => (row.day > max ? row.day : max), '');
  const dayRows = rows.filter((row) => row.day === latest);
  const known = dayRows.reduce((sum, row) => sum + Math.max(0, row.devices), 0);
  if (known <= 0) return null;
  const returning = dayRows
    .filter((row) => RETURNING.has(row.age))
    .reduce((sum, row) => sum + Math.max(0, row.devices), 0);
  /**
   * Whether a 7-day age exists anywhere in the window.
   *
   * The share above is one day's, and one day can legitimately hold a single
   * six-day-old device. Without this the screen prints "0 of 1" forever and reads as a
   * product that never retains anyone, when it is a sample that has not aged yet.
   */
  const anyReturning = rows.some((row) => RETURNING.has(row.age) && row.devices > 0);
  return { day: latest, returning, known, anyReturning };
}
