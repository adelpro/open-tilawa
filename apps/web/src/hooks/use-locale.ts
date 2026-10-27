import { atom, useAtom } from 'jotai';
import { useEffect } from 'react';

import { loadState, patchSettings } from '@/hooks/use-persistence';
import { DIRECTION, MESSAGES, normaliseLocale, type Locale, type Messages } from '@/i18n/messages';

// Seeded from storage, not a constant: the pre-paint apply in main.tsx and this
// hook must agree, or the effect below immediately repaints the default.
export const localeAtom = atom<Locale>(resolveInitialLocale());

export function resolveInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'ar';
  return normaliseLocale(loadState().settings.locale);
}

/** `lang` and `dir` on <html>: everything else follows the document direction. */
export function applyLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = DIRECTION[locale];
}

export function useLocale(): {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Messages;
  dir: 'rtl' | 'ltr';
} {
  const [locale, setLocaleAtom] = useAtom(localeAtom);

  useEffect(() => {
    applyLocale(locale);
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleAtom(next);
    applyLocale(next);
    patchSettings({ locale: next });
  };

  return { locale, setLocale, t: MESSAGES[locale], dir: DIRECTION[locale] };
}
