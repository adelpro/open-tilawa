const KEY = 'open-tilawa:device-name';

function getBrowserVersion(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent || '';
  if (ua.includes('Edg/')) {
    const m = ua.match(/Edg\/([\d.]+)/);
    return m ? `Edge ${m[1]}` : 'Edge';
  }
  if (ua.includes('OPR/') || ua.includes('Opera/')) {
    const m = ua.match(/(?:OPR|Opera)\/([\d.]+)/);
    return m ? `Opera ${m[1]}` : 'Opera';
  }
  if (ua.includes('Firefox/')) {
    const m = ua.match(/Firefox\/([\d.]+)/);
    return m ? `Firefox ${m[1]}` : 'Firefox';
  }
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    const m = ua.match(/Chrome\/([\d.]+)/);
    return m ? `Chrome ${m[1]}` : 'Chrome';
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    const m = ua.match(/Version\/([\d.]+)/);
    return m ? `Safari ${m[1]}` : 'Safari';
  }
  return '';
}

function getSystemInfo(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent || '';
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    '';
  let os = '';
  if (/Windows/i.test(ua) || /Win/i.test(platform)) {
    const m = ua.match(/Windows NT ([\d.]+)/);
    os = m ? `Windows ${m[1]}` : 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua) || /Mac/i.test(platform)) {
    const m = ua.match(/Mac OS X ([\d_]+)/);
    os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/Android/i.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/);
    os = m ? `Android ${m[1]}` : 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const m = ua.match(/OS ([\d_]+)/);
    os = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  const browser = getBrowserVersion();
  const parts = [os, browser].filter(Boolean);
  return parts.join(' • ');
}

function deriveName(): string {
  const sys = getSystemInfo();
  if (sys) return sys;
  return 'Browser';
}

export function getOrCreateDeviceName(): string {
  if (typeof window === 'undefined') return 'Device';
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && existing.length > 0) {
      // Migrate old names to follow convention (OS • Browser Version)
      const sys = getSystemInfo();
      if (sys && existing !== sys) {
        window.localStorage.setItem(KEY, sys);
        return sys;
      }
      return existing;
    }
    const name = getSystemInfo() || deriveName();
    window.localStorage.setItem(KEY, name);
    return name;
  } catch {
    return getSystemInfo() || deriveName();
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
