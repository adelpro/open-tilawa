import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { api } from '../api';
import { useSession } from '../session';
import { ar } from './ar';
import { en } from './en';
import type { Catalogue, MessageKey } from './en';

export type { MessageKey } from './en';

/**
 * The interface language.
 *
 * Declared here rather than imported from `@tilawa-admin/core`: the SPA bundle does not
 * carry the server's package, and pulling it in for a two-value union would ship
 * every store and gate module to the browser. The price is that the union exists
 * twice; the API rejects anything else, so a third value here would fail loudly.
 */
export type Locale = 'en' | 'ar';

export const LOCALES: readonly Locale[] = ['en', 'ar'] as const;

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

const CATALOGUES: Record<Locale, Catalogue> = { en, ar };
const STORAGE_KEY = 'tilawa.locale';

/** Text direction is a property of the language, never a user choice. */
export function directionOf(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ar';
}

/**
 * Which language to render, in order of authority:
 *
 * 1. an explicit choice saved on this device (the person already answered),
 * 2. the account's stored preference (the same answer, from another device),
 * 3. what the browser says it prefers,
 * 4. English.
 *
 * The saved choice outranks the account on purpose: switching language to read one
 * screen should not be undone by the next page load.
 */
export function resolveLocale(input: {
  stored?: string | null;
  account?: string | null;
  languages?: readonly string[];
}): Locale {
  if (isLocale(input.stored)) return input.stored;
  if (isLocale(input.account)) return input.account;
  for (const tag of input.languages ?? []) {
    if (tag.toLowerCase().startsWith('ar')) return 'ar';
    if (tag.toLowerCase().startsWith('en')) return 'en';
  }
  return 'en';
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode, or storage disabled: the choice simply does not persist.
    return null;
  }
}

function writeStored(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* not worth surfacing: the language still applies to this session */
  }
}

interface I18nValue {
  locale: Locale;
  dir: 'ltr' | 'rtl';
  /** True once the language has been decided; screens can render without flicker. */
  ready: boolean;
  setLocale(locale: Locale): Promise<void>;
  saving: boolean;
  t(key: MessageKey, params?: Record<string, string | number>): string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }): ReactElement {
  const { user } = useSession();
  const [locale, setLocaleState] = useState<Locale>(() =>
    resolveLocale({ stored: readStored(), languages: browserLanguages() }),
  );
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  // A signed-in account's stored preference wins on load, but only when this device
  // has no choice of its own.
  useEffect(() => {
    if (!user) {
      setReady(true);
      return;
    }
    if (!isLocale(readStored()) && isLocale(user.locale)) setLocaleState(user.locale);
    setReady(true);
  }, [user]);

  // `lang` and `dir` live on the document element: it is what makes the browser
  // hyphenate, pick fonts and place the scrollbar correctly, and what assistive
  // technology reads first. Setting them in React alone would miss the document.
  useEffect(() => {
    const dir = directionOf(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const setLocale = useCallback(
    async (next: Locale) => {
      if (!isLocale(next) || next === locale) return;
      setLocaleState(next);
      writeStored(next);
      if (!user) return;
      setSaving(true);
      try {
        await api('/me', { method: 'PATCH', body: { user: { locale: next } } });
      } catch {
        // The interface already switched, which is what the person asked for; the
        // stored preference is the part that failed. It retries on the next change.
      } finally {
        setSaving(false);
      }
    },
    [locale, user],
  );

  const value = useMemo<I18nValue>(() => {
    const catalogue = CATALOGUES[locale] ?? en;
    return {
      locale,
      dir: directionOf(locale),
      ready,
      setLocale,
      saving,
      t(key, params) {
        const template = catalogue[key] ?? en[key] ?? key;
        if (!params) return template;
        return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
          name in params ? String(params[name]) : whole,
        );
      },
    };
  }, [locale, ready, setLocale, saving]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside LocaleProvider');
  return value;
}

/** Convenience for components that only need the function. */
export function useT(): I18nValue['t'] {
  return useI18n().t;
}
