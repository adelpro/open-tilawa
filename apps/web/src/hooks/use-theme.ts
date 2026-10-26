import { useEffect, useState } from 'react';

import { loadState, patchState } from '@/hooks/use-persistence';

export type Theme = 'light' | 'dark';

/** Pure so the precedence is testable: stored beats the OS, OS beats light. */
export function resolveTheme(stored: Theme | undefined, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

export function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Reads storage; used once before the first paint so there is no flash. */
export function resolveInitialTheme(): Theme {
  const stored = typeof window === 'undefined' ? undefined : loadState().theme;
  return resolveTheme(stored, prefersDark());
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

/**
 * `data-theme` on <html>, not a class: one attribute flips five custom
 * properties and `color-scheme`, and the choice is what gets stored.
 */
export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(() => resolveInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    patchState({ theme: next });
  };

  return { theme, setTheme };
}
