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

import { STORAGE_KEYS } from '@/utils/storage-keys';

const KEY = STORAGE_KEYS.telemetryDeviceDay;
const LISTEN_KEY = STORAGE_KEYS.telemetryListenDay;

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** True when this day has not been reported yet; the caller still has to check consent. */
export function shouldReportDevice(lastDay: string | null, day: string): boolean {
  return lastDay !== day;
}

export function readDeviceDay(storage: Pick<Storage, 'getItem'> = window.localStorage): string | null {
  return readDay(KEY, storage);
}

export function markDeviceDay(
  day: string,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  markDay(KEY, day, storage);
}

/**
 * The same flag, for the day this device first played something.
 *
 * Two flags, not one: the funnel is the difference between "opened the app" and
 * "actually listened", and a single day row could only ever answer one of them.
 */
export function readListenDay(storage: Pick<Storage, 'getItem'> = window.localStorage): string | null {
  return readDay(LISTEN_KEY, storage);
}

export function markListenDay(
  day: string,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  markDay(LISTEN_KEY, day, storage);
}

function readDay(key: string, storage: Pick<Storage, 'getItem'>): string | null {
  try {
    return storage.getItem(key);
  } catch {
    // A blocked store means we ask again rather than invent an answer.
    return null;
  }
}

function markDay(key: string, day: string, storage: Pick<Storage, 'setItem'>): void {
  try {
    storage.setItem(key, day);
  } catch {
    // Nothing to do: the next load reports again, which is a second row, not a person.
  }
}
