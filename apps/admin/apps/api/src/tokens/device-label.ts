/**
 * Turns a raw `User-Agent` string into the short label a person recognises:
 * "Chrome 141 · Android". The stored header is kept in the database — it is the
 * honest record — but a device table that prints it verbatim is unreadable, and
 * a plain "Unknown device" throws away information the server already has.
 *
 * Deliberate limits: this is presentation, not fingerprinting. It never throws,
 * never guesses a version it cannot find, and falls back to the original string
 * (trimmed, truncated) rather than to "Unknown".
 */

export interface ParsedDeviceLabel {
  /** "Chrome 141 · Android", or the raw header when nothing parses. */
  label: string;
  browser?: string;
  os?: string;
}

const BROWSER_RULES: Array<{ name: string; pattern: RegExp; versionGroup?: number }> = [
  // Order matters: Edge and Opera both advertise Chrome, and Chrome advertises Safari.
  { name: 'Edge', pattern: /Edg(?:e|A|iOS)?\/(\d+)/ },
  { name: 'Opera', pattern: /OPR\/(\d+)/ },
  { name: 'Chrome', pattern: /Chrome\/(\d+)/ },
  { name: 'Firefox', pattern: /Firefox\/(\d+)/ },
  { name: 'Safari', pattern: /Version\/(\d+)[.\d]* Safari/ },
];

const OS_RULES: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Windows', pattern: /Windows NT/ },
  { name: 'Android', pattern: /Android/ },
  { name: 'iOS', pattern: /iPhone|iPad|iPod/ },
  { name: 'macOS', pattern: /Mac OS X/ },
  { name: 'Linux', pattern: /Linux/ },
];

function parseBrowser(ua: string): { name: string; version?: string } | null {
  for (const rule of BROWSER_RULES) {
    const match = ua.match(rule.pattern);
    if (match) return { name: rule.name, version: match[1] };
  }
  return null;
}

function parseOs(ua: string): string | null {
  // Android reports Linux too; the more specific rule wins here.
  for (const rule of OS_RULES) {
    if (rule.pattern.test(ua)) return rule.name;
  }
  return null;
}

/** Best-effort. Never throws; an unparseable string is still returned as-is. */
export function describeDevice(userAgent: string | null | undefined): ParsedDeviceLabel {
  const ua = (userAgent ?? '').trim();
  if (!ua) return { label: '' };

  const browser = parseBrowser(ua);
  const os = parseOs(ua);
  if (!browser && !os) {
    return { label: ua.length > 80 ? `${ua.slice(0, 77)}…` : ua };
  }

  const browserPart = browser
    ? `${browser.name}${browser.version ? ` ${browser.version}` : ''}`
    : null;
  const label = [browserPart, os].filter(Boolean).join(' · ');
  return { label, browser: browser?.name, os: os ?? undefined };
}

/** `describeDevice` from the JSON a session row stores. */
export function describeFingerprint(
  fingerprintJson: string | null | undefined,
): string | undefined {
  if (!fingerprintJson) return undefined;
  try {
    const parsed = JSON.parse(fingerprintJson) as { label?: unknown };
    if (typeof parsed.label !== 'string' || !parsed.label.trim()) return undefined;
    return describeDevice(parsed.label).label || undefined;
  } catch {
    return undefined;
  }
}
