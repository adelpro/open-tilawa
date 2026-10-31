import { atom, useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';

import { loadState, patchSettings } from '@/hooks/use-persistence';
import { navigate } from '@/hooks/use-route';
import { parseUrl, toUrl } from '@/routes';
import { DIRECTION, MESSAGES, normaliseLocale, type Locale, type Messages } from '@/i18n/messages';

// Seeded from storage, not a constant: the pre-paint apply in main.tsx and this
// hook must agree, or the effect below immediately repaints the default.
export const localeAtom = atom<Locale>(resolveInitialLocale());

/**
 * The language a page opens in.
 *
 * The address wins when it names a language: `/en/about` is English whatever this
 * device chose last. A bare path names none of them, so the stored preference
 * decides — and `alignUrlWithLocale` then moves it to the address that says what
 * it is showing.
 */
export function resolveInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'ar';
  if (parseUrl(window.location.pathname).locale === 'en') return 'en';
  return normaliseLocale(loadState().settings.locale);
}

/**
 * Rewrite a bare address into the language it is about to be painted in.
 *
 * Without this, a listener who chose English lands on `/` — Arabic HTML, English
 * text — and the crawler and the visitor disagree about what that URL is. One
 * `replaceState`, before the first paint, so there is no history entry to go back to.
 */
export function alignUrlWithLocale(locale: Locale): void {
  if (typeof window === 'undefined' || locale !== 'en') return;
  const { locale: inUrl, route } = parseUrl(window.location.pathname);
  if (inUrl === locale) return;
  window.history.replaceState({}, '', `${toUrl(route, locale)}${window.location.search}`);
}

/** `lang` and `dir` on <html>: everything else follows the document direction. */
export function applyLocale(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = DIRECTION[locale];
}

/**
 * Put the language in the address, without a new history entry.
 *
 * The address is the language once the app is running: a switch that only repaints
 * leaves the listener on the other language's URL, and the link they copy then
 * sends everyone to the wrong one.
 */
function moveAddressTo(locale: Locale): void {
  if (typeof window === 'undefined') return;
  navigate(parseUrl(window.location.pathname).route, 'replace', locale);
}

export function useLocale(): {
  locale: Locale;
  setLocale: (next: Locale) => void;
  adoptLocale: (next: Locale) => void;
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
    moveAddressTo(next);
  };

  /**
   * Apply a locale that came from the account. No `patchSettings`: that writes
   * back to the relay, and the value just arrived from there.
   */
  const adoptLocale = useCallback(
    (next: Locale) => {
      setLocaleAtom(next);
      applyLocale(next);
      moveAddressTo(next);
    },
    [setLocaleAtom],
  );

  return { locale, setLocale, adoptLocale, t: MESSAGES[locale], dir: DIRECTION[locale] };
}
