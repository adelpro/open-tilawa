import { atom, useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';

import { loadState, patchSettings } from '@/hooks/use-persistence';

export type Theme = 'light' | 'dark';

// Seeded from storage for the same reason as the locale: main.tsx paints first,
// and an atom default would undo it on mount.
export const themeAtom = atom<Theme>(resolveInitialTheme());

export function resolveTheme(stored: Theme | undefined, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveInitialTheme(): Theme {
  const raw = typeof window === 'undefined' ? undefined : loadState().settings.theme;
  const stored = raw === 'light' || raw === 'dark' ? raw : undefined;
  return resolveTheme(stored, prefersDark());
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;

  // The status bar belongs to the screen, not to the browser: a white strip
  // over a black page reads as a rendering bug. Read the token back after the
  // palette is applied so the two can never drift apart.
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && background) meta.setAttribute('content', background);
}

/** One attribute on <html>; the palette does the rest. */
export function useTheme(): {
  theme: Theme;
  setTheme: (next: Theme) => void;
  adoptTheme: (next: Theme) => void;
} {
  const [theme, setThemeAtom] = useAtom(themeAtom);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  /**
   * The palette is one attribute on <html>, so the switch can cross-fade
   * instead of flashing. Rare, deliberate action: the one place the app is
   * allowed a full-page transition. `adoptTheme` stays instant — it arrives
   * from the ring at load, and animating a colour nobody asked for is a flash
   * with extra steps.
   */
  const setTheme = (next: Theme) => {
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => { finished: Promise<void> };
    };
    const commit = () => {
      // flushSync, not a bare setter: the new snapshot is taken when this
      // returns, so React's commit has to be inside it or the chips lag a frame.
      flushSync(() => setThemeAtom(next));
      applyTheme(next);
    };

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof doc.startViewTransition !== 'function'
    ) {
      commit();
    } else {
      doc.startViewTransition(commit);
    }

    patchSettings({ theme: next });
  };

  /** Same contract as `adoptLocale`: apply without writing back to the ring. */
  const adoptTheme = useCallback(
    (next: Theme) => {
      setThemeAtom(next);
      applyTheme(next);
    },
    [setThemeAtom],
  );

  return { theme, setTheme, adoptTheme };
}
