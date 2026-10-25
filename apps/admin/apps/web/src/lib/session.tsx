import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { ApiError, api } from './api';

export interface Me {
  id: number;
  email: string;
  name: string;
  about?: string;
  role: 'user' | 'admin' | 'super_admin';
  /** True for the one Owner; display only, never an authorization input. */
  isOwner?: boolean;
  isActivated: boolean;
  isTwoFAEnabled: boolean;
  isDeviceTrusted: boolean;
  avatarUpdatedAt?: string | null;
  /** False for an account created through a provider, until a password is set. */
  passwordSet?: boolean;
  /** Interface language stored on the account; absent for older sessions. */
  locale?: 'en' | 'ar';
  /** Interface theme stored on the account; absent for older sessions. */
  theme?: 'light' | 'dark' | 'system';
  /** The account's fallback master step; only used when a profile has none. */
  masterName?: string | null;
  masterBody?: string | null;
}

interface SessionValue {
  user: Me | null;
  loading: boolean;
  refresh(): Promise<Me | null>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/**
 * The session, read from `GET /api/me`.
 *
 * The cookie is httpOnly, so this is the only way to know who is signed in — and
 * because it is the server's answer, a stale tab cannot keep pretending. A 401
 * is a normal state here (signed out), not an error.
 */
export function SessionProvider({ children }: { children: ReactNode }): ReactElement {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<Me | null> => {
    try {
      const me = await api<Me>('/me');
      // The answer must be an account, not merely a 200. Served standalone or
      // behind a misconfigured proxy, `/api/me` can resolve to the SPA's own
      // `index.html`; treating that HTML as an account put a string where a user
      // belonged and crashed the shell on `name.split` — a blank page instead of a
      // sign-in screen. A payload without an id is a signed-out state.
      if (!me || typeof me !== 'object' || typeof me.id !== 'number') {
        setUser(null);
        return null;
      }
      setUser(me);
      return me;
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setUser(null);
        return null;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await api('/auth/signout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ user, loading, refresh, signOut }),
    [user, loading, refresh, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
