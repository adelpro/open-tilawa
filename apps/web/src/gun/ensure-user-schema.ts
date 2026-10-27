import { user } from './index';
import { CURRENT_USER_SCHEMA_VERSION } from './user-schema';
import { migrateUserGraph, type UserGraphSnapshot } from './user-migrations';

/**
 * `.once()` on a path the relay has never seen does not always answer, and the
 * schema write used to sit behind that callback — so a fresh account never got
 * a version stamp. A bounded read keeps the migration path, without letting an
 * empty node block the write.
 */
const READ_TIMEOUT_MS = 1500;

function once<T = unknown>(node: any, timeout = READ_TIMEOUT_MS): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeout);
    try {
      node.once((data: T) => {
        clearTimeout(timer);
        finish(data ?? null);
      });
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

const MIGRATED_PATHS = [
  'profile',
  'settings',
  'favorites',
  'favMeta',
  'reciter',
  'surah',
  'progress',
  'recentlyViewed',
  'mostViewed',
  'devices',
  'viewedMeta',
];

async function snapshotUserGraph(): Promise<UserGraphSnapshot> {
  if (!user.is) return {};
  const entries = await Promise.all(
    MIGRATED_PATHS.map(async (key) => {
      const value = await once(user.get(key));
      return [key, value] as const;
    }),
  );
  const snapshot: UserGraphSnapshot = {};
  for (const [key, value] of entries) {
    if (value && typeof value === 'object') snapshot[key] = value;
  }
  return snapshot;
}

/**
 * Runs once per login. Additive schema changes need no migration, so this is a
 * no-op on the common path: one read, then nothing.
 */
export async function ensureUserSchema(): Promise<void> {
  if (!user.is) return;

  try {
    const schema = await once<{ version?: number }>(user.get('schema'));
    const fromVersion = typeof schema?.version === 'number' ? schema.version : 0;

    if (fromVersion >= CURRENT_USER_SCHEMA_VERSION) return;

    if (fromVersion > 0) {
      const migrated = migrateUserGraph(await snapshotUserGraph(), fromVersion);
      for (const [key, value] of Object.entries(migrated)) {
        if (key === '_schemaVersion') continue;
        if (value && typeof value === 'object') user.get(key).put(value);
      }
    }

    user.get('schema').put({ version: CURRENT_USER_SCHEMA_VERSION, updatedAt: Date.now() });
  } catch {
    // A schema stamp is not worth blocking playback or favourites.
  }
}
