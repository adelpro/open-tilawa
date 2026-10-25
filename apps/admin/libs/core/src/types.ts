export type Role = 'user' | 'admin' | 'super_admin';

/**
 * The interface languages, in the order the selector offers them. English first
 * because it is the default the database stores, Arabic second because it is the
 * one the layout has to keep working for.
 */
export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * The interface language a client is asking for, from an `Accept-Language` header.
 *
 * Deliberately crude: `ar-DZ`, `ar` and `AR` all mean Arabic, anything else means
 * English. Negotiating q-values properly would buy nothing here — there are two
 * languages, and the header is a hint that the saved preference overrules.
 */
export function localeFromAcceptLanguage(header: string | undefined | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const first = header.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('ar') ? 'ar' : DEFAULT_LOCALE;
}

/**
 * The interface themes. `system` is the default because a new account has not
 * answered the question yet, and following the operating system is the honest
 * answer until it does.
 */
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = 'system';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** Numeric rank so `@Roles('admin')` is satisfied by `super_admin` (P5). */
export const ROLE_RANK: Record<Role, number> = {
  user: 0,
  admin: 1,
  super_admin: 2,
};

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  password_hash: string | null;
  role: Role;
  tier: string;
  status: string;
  profile_picture: string | null;
  cover_image: string | null;
  about: string | null;
  social_links: string[] | null;
  is_activated: number;
  twofa_enabled: number;
  twofa_secret: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: number;
  user_id: number;
  token_hash: string;
  fingerprint_hash: string | null;
  fingerprint_json: string | null;
  created_at: string;
  expires_at: string;
  last_seen_at: string | null;
}

export interface TrustedDeviceRecord {
  id: number;
  user_id: number;
  fingerprint_hash: string;
  fingerprint_json: string;
  added_at: string;
  expires_at: string | null;
}

/** The ported fingerprint object: a label plus whatever the client sends. */
export interface FingerprintObj {
  label?: string;
  [key: string]: unknown;
}
