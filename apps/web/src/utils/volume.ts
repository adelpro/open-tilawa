import { STORAGE_KEYS } from '@/utils/storage-keys';

/**
 * Output level, 0–1, device-local.
 *
 * 0 is the mute state: a listener who drags the gauge to the floor and one who
 * holds the speaker should see the same icon and hear the same silence. The
 * level is remembered per device because loudness belongs to the room and the
 * speaker, not to the account.
 */

export const DEFAULT_VOLUME = 1;

export type VolumeStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Storage can throw in private mode; a blocked store is simply no preference. */
function defaultStorage(): VolumeStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, value));
}

export function readVolume(storage: VolumeStorage | null = defaultStorage()): number {
  if (!storage) return DEFAULT_VOLUME;
  try {
    const raw = storage.getItem(STORAGE_KEYS.volume);
    if (raw === null) return DEFAULT_VOLUME;
    const value = Number(raw);
    return Number.isFinite(value) ? clampVolume(value) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function writeVolume(value: number, storage: VolumeStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.volume, String(clampVolume(value)));
  } catch {
    // Quota or private mode: the level still holds for this session.
  }
}

/**
 * Mute keeps the level it silenced, so a second press restores it. A store that
 * somehow says "last was also zero" restores full volume rather than leaving a
 * listener stuck at 0.
 */
export function toggleVolume(
  volume: number,
  lastVolume: number,
): { volume: number; lastVolume: number } {
  const current = clampVolume(volume);
  if (current > 0) return { volume: 0, lastVolume: current };
  const restored = clampVolume(lastVolume) || DEFAULT_VOLUME;
  return { volume: restored, lastVolume: restored };
}
