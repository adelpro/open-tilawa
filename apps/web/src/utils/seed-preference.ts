/**
 * Whether this device shares pieces with other listeners.
 *
 * Device-local on purpose. Bandwidth and privacy belong to the device and the
 * network it is on, so a value carried across the ring would let a desktop's
 * answer follow a phone onto mobile data.
 *
 * Sharing is the product's premise, so an absent key means `on`: this is a way
 * to opt out, not a consent screen.
 */

import { STORAGE_KEYS } from './storage-keys';

type Readable = Pick<Storage, 'getItem'>;
type Writable = Pick<Storage, 'setItem'>;

function local(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // A browser with storage denied is not a reason to stop listening.
    return null;
  }
}

export function sharesPieces(storage: Readable | null = local()): boolean {
  try {
    return storage?.getItem(STORAGE_KEYS.seed) !== 'off';
  } catch {
    return true;
  }
}

export function setSharesPieces(allowed: boolean, storage: Writable | null = local()): void {
  try {
    storage?.setItem(STORAGE_KEYS.seed, allowed ? 'on' : 'off');
  } catch {
    // Nothing to do: the switch still applies to this session.
  }
}
