import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  markDeviceDay,
  markListenDay,
  readDeviceDay,
  readListenDay,
  shouldReportDevice,
  utcDay,
} from '../src/utils/device-day.ts';
import { STORAGE_KEYS } from '../src/utils/storage-keys.ts';

/** A store that behaves: it remembers what was written, per key. */
function memory(initial: string | null = null): Pick<Storage, 'getItem' | 'setItem'> & {
  value: string | null;
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  if (initial !== null) values.set(STORAGE_KEYS.telemetryDeviceDay, initial);
  return {
    values,
    get value() {
      return values.get(STORAGE_KEYS.telemetryDeviceDay) ?? null;
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

test('the day is UTC, because the server buckets by the day the event arrives', () => {
  assert.equal(utcDay(new Date('2026-10-30T23:59:59Z')), '2026-10-30');
  assert.equal(utcDay(new Date('2026-10-31T00:00:01Z')), '2026-10-31');
});

test('a device reports once a day, and the flag is per device, not per visit', () => {
  const store = memory();
  assert.equal(shouldReportDevice(readDeviceDay(store), '2026-10-30'), true);
  markDeviceDay('2026-10-30', store);
  assert.equal(shouldReportDevice(readDeviceDay(store), '2026-10-30'), false);
  // Tomorrow is a new day: the same device is counted again, without an identifier.
  assert.equal(shouldReportDevice(readDeviceDay(store), '2026-10-31'), true);
});

test('a device that plays reports it once a day, on its own flag', () => {
  const store = memory();
  // Opening the app and playing it are two different days-flags: the funnel needs
  // both, so one must not answer for the other.
  assert.equal(readListenDay(store), null);
  assert.equal(readDeviceDay(store), null);

  markDeviceDay('2026-10-30', store);
  assert.equal(shouldReportDevice(readListenDay(store), '2026-10-30'), true);

  markListenDay('2026-10-30', store);
  assert.equal(shouldReportDevice(readListenDay(store), '2026-10-30'), false);
  assert.equal(shouldReportDevice(readListenDay(store), '2026-10-31'), true);
  assert.equal(readDeviceDay(store), '2026-10-30');
});

test('a blocked store asks again rather than inventing an answer', () => {
  const blocked = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
  } as unknown as Pick<Storage, 'getItem' | 'setItem'>;

  assert.equal(readDeviceDay(blocked), null);
  assert.doesNotThrow(() => markDeviceDay('2026-10-30', blocked));
  assert.equal(shouldReportDevice(readDeviceDay(blocked), '2026-10-30'), true);
});
