import { useAtom } from 'jotai';
import { useEffect } from 'react';

import { patchState } from '@/hooks/use-persistence';
import { themeAtom } from '@/jotai/ui';

export type Theme = 'dark' | 'light';

/**
 * Applies the theme attribute and remembers the choice in the v2 state.
 *
 * Dark is not a mode here, it is the identity — so `prefers-color-scheme` is
 * deliberately ignored. Light is a choice you make, not one the OS makes for you.
 */
export function useTheme(): { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeAtom] = useAtom(themeAtom);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#000000');
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeAtom(next);
    patchState({ theme: next });
  };

  return {
    theme,
    setTheme,
    toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  };
}
