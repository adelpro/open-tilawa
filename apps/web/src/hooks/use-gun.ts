import { useCallback, useEffect } from 'react';
import { useAtom } from 'jotai';

import { gun, user, type GunAck } from '@/gun';
import { ensureUserSchema } from '@/gun/ensure-user-schema';
import { touchDevice } from '@/hooks/use-user-sync';
import {
  gunLoggedInAtom,
  gunUserPubAtom,
  gunUserAliasAtom,
  gunLoadingAtom,
  gunErrorAtom,
} from '@/jotai/gun';

function syncAuthAtoms(
  setLoggedIn: (v: boolean) => void,
  setPub: (v: string | null) => void,
  setAlias: (v: string | null) => void,
) {
  if (!user.is) {
    setLoggedIn(false);
    setPub(null);
    setAlias(null);
    return;
  }
  setLoggedIn(true);
  setPub(user.is.pub || null);
  // recall() restores the keypair but not the alias, and Gun then reports the
  // pub as the alias. Fall back to the alias stored in the account profile so
  // a returning device still shows the name the user chose.
  const alias = user.is.alias;
  const looksLikePub = !alias || alias === user.is.pub || alias.includes('.');
  setAlias(looksLikePub ? null : alias);
  if (looksLikePub) {
    user
      .get('profile')
      .get('alias')
      .once((stored: unknown) => {
        if (typeof stored === 'string' && stored) setAlias(stored);
      });
  }
}

/**
 * Auth surface. Gun emits `auth` on the root for create/login/leave/recall, so
 * this needs no polling loop.
 */
export function useGun() {
  const [loggedIn, setLoggedIn] = useAtom(gunLoggedInAtom);
  const [pub, setPub] = useAtom(gunUserPubAtom);
  const [alias, setAlias] = useAtom(gunUserAliasAtom);
  const [loading, setLoading] = useAtom(gunLoadingAtom);
  const [error, setError] = useAtom(gunErrorAtom);

  useEffect(() => {
    const onAuth = () => {
      syncAuthAtoms(setLoggedIn, setPub, setAlias);
      if (user.is) {
        void ensureUserSchema().then(() => touchDevice());
      }
    };
    onAuth(); // recall() may have restored a session before mount
    gun.on('auth', onAuth);
    return () => {
      try {
        (gun as unknown as { off?: () => void }).off?.();
      } catch {
        // already detached
      }
    };
  }, [setLoggedIn, setPub, setAlias]);

  const run = useCallback(
    (action: (done: (ack: GunAck) => void) => void) =>
      new Promise<GunAck>((resolve) => {
        setLoading(true);
        setError(null);
        action((ack) => {
          if (ack?.err) setError(ack.err);
          setLoading(false);
          resolve(ack);
        });
      }),
    [setLoading, setError],
  );

  const createUser = useCallback(
    (aliasName: string, password: string) =>
      run((done) => {
        user.create(aliasName, password, (created: GunAck) => {
          if (created.err) return done(created);
          user.auth(aliasName, password, (ack: GunAck) => {
            // The alias is not recoverable from the keypair, so keep it in the
            // account graph for every linked device to read back.
            if (!ack.err) {
              user.get('profile').put({ alias: aliasName, updatedAt: Date.now() });
            }
            done(ack);
          });
        });
      }),
    [run],
  );

  const loginUser = useCallback(
    (aliasName: string, password: string) => run((done) => user.auth(aliasName, password, done)),
    [run],
  );

  const authWithPair = useCallback(
    (pair: unknown) => run((done) => (gun.user() as any).auth(pair, done)),
    [run],
  );

  const logout = useCallback(() => {
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
    alias,
    loading,
    error,
    createUser,
    loginUser,
    authWithPair,
    logout,
    getPair,
    user,
    gun,
  };
}
