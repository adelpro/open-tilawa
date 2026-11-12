import { STORAGE_KEYS } from '@/utils/storage-keys';

/**
 * How the player chooses the next surah.
 *
 * - `linear` walks the release in mushaf order and wraps after the last one.
 * - `shuffle` walks a shuffled queue of the release, rebuilt when the mode is
 *   selected and when the reciter changes; Previous follows the same queue.
 * - `repeat-one` repeats the current file forever when it ends. Manual Next /
 *   Previous still move: the mode is about the end of a surah, not a lock.
 *
 * Device-local on purpose (see `readPlaybackMode`): a mode is how this room is
 * listening, not an account setting the next device should inherit.
 */
export type PlaybackMode = 'linear' | 'shuffle' | 'repeat-one';

export const PLAYBACK_MODES: readonly PlaybackMode[] = ['linear', 'shuffle', 'repeat-one'];

export function isPlaybackMode(value: unknown): value is PlaybackMode {
  return typeof value === 'string' && (PLAYBACK_MODES as readonly string[]).includes(value);
}

/** The one-button cycle: linear → shuffle → repeat-one → linear. */
export function nextPlaybackMode(mode: PlaybackMode): PlaybackMode {
  return mode === 'linear' ? 'shuffle' : mode === 'shuffle' ? 'repeat-one' : 'linear';
}

export type PlaybackStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Storage can throw in private mode; a blocked store is simply no preference. */
function defaultStorage(): PlaybackStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readPlaybackMode(storage: PlaybackStorage | null = defaultStorage()): PlaybackMode {
  if (!storage) return 'linear';
  try {
    const raw = storage.getItem(STORAGE_KEYS.playbackMode);
    return isPlaybackMode(raw) ? raw : 'linear';
  } catch {
    return 'linear';
  }
}

export function writePlaybackMode(
  mode: PlaybackMode,
  storage: PlaybackStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEYS.playbackMode, mode);
  } catch {
    // Quota or private mode: the mode still holds for this session.
  }
}

/**
 * Fisher–Yates on a copy.
 *
 * `random` is injected so a test can pin the order; production passes
 * `Math.random`. The input is never reordered in place — the release manifest
 * is shared state.
 */
export function shuffledOrder(
  ids: readonly number[],
  random: () => number = Math.random,
): number[] {
  const order = [...ids];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
}

/** The next element of the queue, wrapping; `current` absent starts at the first. */
export function nextInQueue(current: number, queue: readonly number[]): number | null {
  if (queue.length === 0) return null;
  return queue[(queue.indexOf(current) + 1) % queue.length];
}

/** The previous element of the queue, wrapping; `current` absent starts at the last. */
export function previousInQueue(current: number, queue: readonly number[]): number | null {
  if (queue.length === 0) return null;
  const at = queue.indexOf(current);
  // An unknown current is treated as the first, so stepping back lands on the
  // last - the mirror of `nextInQueue` starting at the first.
  return queue[((at === -1 ? 0 : at) - 1 + queue.length) % queue.length];
}
