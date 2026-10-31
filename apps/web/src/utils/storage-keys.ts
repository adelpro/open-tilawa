/**
 * Every `localStorage` key and the one window event the app owns.
 *
 * The namespace is the product's name, not the repository's: a listener who
 * opens devtools should see `tilawah:*` and recognise it. Before this module the
 * keys said `open-tilawa`, and renaming them without a migration would have
 * deleted the account key, the favourites mirror and the telemetry answer of
 * every existing listener — so `migrateStorageNamespace()` copies old keys
 * forward once, at boot, before anything reads them.
 */

const NS = 'tilawah';
const LEGACY_NS = 'open-tilawa';

export const STORAGE_KEYS = {
  /** The SEA keypair. Losing it loses the ring. */
  account: `${NS}:account`,
  /** Playhead per reciter, settings mirror, legacy state. */
  state: `${NS}:v3`,
  statePrevious: `${NS}:v2`,
  favorites: `${NS}:favorites`,
  /** Prefixes: the identity or reciter id is appended by the caller. */
  countedPrefix: `${NS}:counted:`,
  viewedPrefix: `${NS}:viewed:`,
  recent: `${NS}:recent`,
  anonId: `${NS}:anon-id`,
  deviceId: `${NS}:device-id`,
  deviceName: `${NS}:device-name`,
  deviceLinkedAt: `${NS}:device-linked-at`,
  telemetry: `${NS}:telemetry`,
  telemetryDeviceDay: `${NS}:telemetry-device-day`,
  telemetryListenDay: `${NS}:telemetry-listen-day`,
} as const;

/**
 * The settings write-back event. It is dispatched by the persistence layer and
 * heard by App, which pushes the change up to the ring.
 */
export const STORAGE_EVENT = `${NS}:settings`;

export const LEGACY_STORAGE_PREFIX = `${LEGACY_NS}:`;

export type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem'>;

function copiedKeys(storage: StorageLike): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(LEGACY_STORAGE_PREFIX)) keys.push(key);
    }
  } catch {
    // A blocked store has nothing to migrate.
  }
  return keys;
}

/**
 * Copies `open-tilawa:<suffix>` to `tilawah:<suffix>`.
 *
 * Copy, never move: a tab still running the previous bundle keeps reading the
 * old key, and the sources are dropped in a later release once no bundle can be
 * older than this one. The target wins if it already exists — it is the newer
 * write — and the source is left alone either way, so this is idempotent.
 *
 * Returns how many keys were actually copied, which is what the test asserts.
 */
export function migrateStorageNamespace(storage: StorageLike): number {
  let copied = 0;
  for (const key of copiedKeys(storage)) {
    const target = `${NS}:${key.slice(LEGACY_STORAGE_PREFIX.length)}`;
    try {
      if (storage.getItem(target) !== null) continue;
      const value = storage.getItem(key);
      if (value === null) continue;
      storage.setItem(target, value);
      copied += 1;
    } catch {
      // Quota or private mode: the old key still holds the value.
    }
  }
  return copied;
}
