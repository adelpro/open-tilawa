import { atom, useAtom } from 'jotai';
import { useEffect } from 'react';

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
}

/** One attribute on <html>; the palette does the rest. */
export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void } {
  const [theme, setThemeAtom] = useAtom(themeAtom);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeAtom(next);
    applyTheme(next);
    patchSettings({ theme: next });
  };

  return { theme, setTheme };
}
