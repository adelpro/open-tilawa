const KEY = 'open-tilawa:device-name';

function deriveName(): string {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent || '';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
  return 'Browser';
}

export function getOrCreateDeviceName(): string {
  if (typeof window === 'undefined') return 'Device';
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && existing.length > 0) return existing;
    const name = deriveName();
    window.localStorage.setItem(KEY, name);
    return name;
  } catch {
    return deriveName();
  }
}

export function setDeviceName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, name.trim() || deriveName());
  } catch {
    // ignore
  }
}

export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Device';
  try {
    return window.localStorage.getItem(KEY) || deriveName();
  } catch {
    return deriveName();
  }
}
