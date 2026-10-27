import { getDefaultStore } from 'jotai';

import { clearStoredPair, readStoredPair } from './account-store';
import { gun, user, type GunAck } from './index';
import { ensureUserSchema } from './ensure-user-schema';
import { touchDevice } from '@/hooks/use-user-sync';
import { gunLoggedInAtom, gunUserPubAtom, gunUserAliasAtom } from '@/jotai/gun';

const store = getDefaultStore();

let started = false;

export function authPair(pair: unknown): Promise<GunAck> {
  return new Promise((resolve) => {
    try {
      (gun.user() as any).auth(pair, (ack: GunAck) => resolve(ack || {}));
    } catch (e) {
      resolve({ err: e instanceof Error ? e.message : 'auth failed' });
    }
  });
}

/**
 * Mirrors Gun's auth state into atoms.
 *
 * The name is not part of the keypair — SEA stores only the pair — so it lives
 * in the account profile and every linked device reads it back. Falls back to a
 * short key so the sheet is never blank.
 */
function publish(): void {
  if (!user.is) {
    store.set(gunLoggedInAtom, false);
    store.set(gunUserPubAtom, null);
    store.set(gunUserAliasAtom, null);
    return;
  }

  const pub = user.is.pub || null;
  store.set(gunLoggedInAtom, true);
  store.set(gunUserPubAtom, pub);

  if (!pub) {
    store.set(gunUserAliasAtom, null);
    return;
  }
  store.set(gunUserAliasAtom, null);
  user
    .get('profile')
    .get('name')
    .once((stored: unknown) => {
      store.set(
        gunUserAliasAtom,
        typeof stored === 'string' && stored.trim() ? stored : `${pub.slice(0, 6)}…${pub.slice(-4)}`,
      );
    });
}

/**
 * One auth subscription for the whole app.
 *
 * `gun.off()` takes no argument and removes *every* listener on the chain —
 * including the network's own — so a per-component subscription that cleaned up
 * after itself would have disconnected the relay. This is registered once and
 * never removed.
 */
export function startAuthBridge(): void {
  if (started) return;
  started = true;

  gun.on('auth', () => {
    publish();
    if (user.is) void ensureUserSchema().then(() => touchDevice());
  });

  publish();

  // Gun's recall() only writes to sessionStorage, so a stored keypair is the
  // only thing that survives closing the browser.
  if (!user.is) {
    const stored = readStoredPair();
    if (stored) {
      void authPair(stored).then((ack) => {
        if (ack.err) clearStoredPair();
        publish();
      });
    }
  }
}

/** Called after leave(), which clears `user.is` but emits no auth event. */
export function publishAuthState(): void {
  publish();
}
