/**
 * "Has this device already told us about today?"
 *
 * The flag never leaves the browser, and the event it guards carries no identifier —
 * only the fact that a consenting device opened the app. That is what makes the count
 * a floor (some devices opt out) and a count of devices rather than people: with no id
 * there is nothing to join across days.
 *
 * The day is UTC, because the server buckets the event by the UTC day it arrives on.
 * A local day would send twice near midnight in one direction and never in the other.
 */
const KEY = 'open-tilawa:telemetry-device-day';

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** True when this day has not been reported yet; the caller still has to check consent. */
export function shouldReportDevice(lastDay: string | null, day: string): boolean {
  return lastDay !== day;
}

export function readDeviceDay(storage: Pick<Storage, 'getItem'> = window.localStorage): string | null {
  try {
    return storage.getItem(KEY);
  } catch {
    // A blocked store means we ask again rather than invent an answer.
    return null;
  }
}

export function markDeviceDay(
  day: string,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  try {
    storage.setItem(KEY, day);
  } catch {
    // Nothing to do: the next load reports again, which is a second row, not a person.
  }
}
