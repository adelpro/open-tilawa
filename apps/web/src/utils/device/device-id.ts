const KEY = 'open-tilawa:device-id';

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && existing.length > 0) return existing;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
