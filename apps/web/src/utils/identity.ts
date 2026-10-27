const ANON_KEY = 'open-tilawa:anon-id';

/**
 * Who is counting. Logged-in devices share the SEA `pub`, so a favourite toggled
 * on the phone does not inflate the counter again on the laptop. Anonymous
 * visitors get a stable per-browser id instead of nothing.
 */
export function getAnonId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.localStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `anon_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(ANON_KEY, id);
    return id;
  } catch {
    return 'anon-ephemeral';
  }
}

export function getCountingIdentity(pub: string | null | undefined): string {
  return pub ? `user:${pub}` : `anon:${getAnonId()}`;
}
