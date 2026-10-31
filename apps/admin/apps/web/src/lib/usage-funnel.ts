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
