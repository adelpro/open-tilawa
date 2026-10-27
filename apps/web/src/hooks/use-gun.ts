import { useCallback, useEffect } from 'react';
import { useAtom } from 'jotai';

import { gun, SEA, user, type GunAck } from '@/gun';
import { clearStoredPair, readStoredPair, storePair } from '@/gun/account-store';
import { ensureUserSchema } from '@/gun/ensure-user-schema';
import { touchDevice } from '@/hooks/use-user-sync';
import { getOrCreateDeviceName } from '@/utils/device/device-name';
import {
  gunLoggedInAtom,
  gunUserPubAtom,
  gunUserAliasAtom,
  gunLoadingAtom,
  gunErrorAtom,
} from '@/jotai/gun';

function authPair(pair: unknown): Promise<GunAck> {
  return new Promise((resolve) => {
    try {
      (gun.user() as any).auth(pair, (ack: GunAck) => resolve(ack || {}));
    } catch (e) {
      resolve({ err: e instanceof Error ? e.message : 'auth failed' });
    }
  });
}

/**
 * The name to show for this account. The keypair carries no name — SEA stores
 * only the pair — so it lives in the account profile and every linked device
 * reads it back. Falls back to a short key so the sheet is never blank.
 */
function resolveName(pub: string | null, setAlias: (v: string | null) => void) {
  if (!pub) {
    setAlias(null);
    return;
  }
  setAlias(null);
  user
    .get('profile')
    .get('name')
    .once((stored: unknown) => {
      if (typeof stored === 'string' && stored.trim()) {
        setAlias(stored);
        return;
      }
      setAlias(`${pub.slice(0, 6)}…${pub.slice(-4)}`);
    });
}

/**
 * Auth surface. Gun emits `auth` on the root for create/login/leave/recall, so
 * this needs no polling loop.
 */
export function useGun() {
  const [loggedIn, setLoggedIn] = useAtom(gunLoggedInAtom);
  const [pub, setPub] = useAtom(gunUserPubAtom);
  const [name, setName] = useAtom(gunUserAliasAtom);
  const [loading, setLoading] = useAtom(gunLoadingAtom);
  const [error, setError] = useAtom(gunErrorAtom);

  useEffect(() => {
    const sync = () => {
      if (!user.is) {
        setLoggedIn(false);
        setPub(null);
        setName(null);
        return;
      }
      setLoggedIn(true);
      setPub(user.is.pub || null);
      resolveName(user.is.pub || null, setName);
      void ensureUserSchema().then(() => touchDevice());
    };
    sync(); // recall() may have restored a session before mount

    // Gun's recall() only writes to sessionStorage, so a stored keypair is the
    // only thing that survives closing the browser.
    if (!user.is) {
      const stored = readStoredPair();
      if (stored) {
        void authPair(stored).then((ack) => {
          if (ack.err) clearStoredPair();
        });
      }
    }

    gun.on('auth', sync);
    return () => {
      try {
        (gun as unknown as { off?: () => void }).off?.();
      } catch {
        // already detached
      }
    };
  }, [setLoggedIn, setPub, setName]);

  const run = useCallback(
    async (action: () => Promise<GunAck>): Promise<GunAck> => {
      setLoading(true);
      setError(null);
      try {
        const ack = await action();
        if (ack?.err) setError(ack.err);
        return ack;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError],
  );

  /**
   * An account is a keypair generated here. No username, no password: the key
   * is the identity, and it is the only thing that can open the account. Other
   * devices get it by scanning a pairing code.
   */
  const createAccount = useCallback(
    () =>
      run(async () => {
        const pair = await SEA.pair();
        const ack = await authPair(pair);
        if (!ack.err) {
          storePair(pair);
          user.get('profile').put({
            name: getOrCreateDeviceName(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        return ack;
      }),
    [run],
  );

  const authWithPair = useCallback(
    (pair: unknown) =>
      run(async () => {
        const ack = await authPair(pair);
        if (!ack.err) storePair(pair);
        return ack;
      }),
    [run],
  );

  const renameAccount = useCallback((next: string) => {
    const trimmed = next.trim();
    if (!trimmed) return;
    user.get('profile').put({ name: trimmed, updatedAt: Date.now() });
    setName(trimmed);
  }, [setName]);

  const logout = useCallback(() => {
    clearStoredPair();
    try {
      user.leave();
    } catch {
      // ignore
    }
  }, []);

  /** The SEA pair, read straight off the live user chain. */
  const getPair = useCallback(() => {
    try {
      return (user as any)._.sea || null;
    } catch {
      return null;
    }
  }, []);

  return {
    loggedIn,
    pub,
    name,
    loading,
    error,
    createAccount,
    authWithPair,
    renameAccount,
    logout,
    getPair,
    user,
    gun,
  };
}
