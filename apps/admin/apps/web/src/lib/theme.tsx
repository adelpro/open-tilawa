import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { api } from './api';
import { isPalette, type PaletteId } from './palettes';
import { useSession } from './session';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'tilawa.theme';
const PALETTE_KEY = 'tilawa.palette';

/** `null` means this device has not answered the question yet. */
function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* private mode */
  }
  return null;
}

function writeStored(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* not worth surfacing: the theme still applies to this session */
  }
}

/** The paper is this device's, so it never touches the account. */
function readStoredPalette(): PaletteId {
  try {
    const value = localStorage.getItem(PALETTE_KEY);
    if (isPalette(value)) return value;
  } catch {
    /* private mode */
  }
  return 'white';
}

function writeStoredPalette(palette: PaletteId): void {
  try {
    localStorage.setItem(PALETTE_KEY, palette);
  } catch {
    /* the paper still applies to this session */
  }
}

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return theme;
}

interface ThemeValue {
  theme: Theme;
  resolved: 'light' | 'dark';
  palette: PaletteId;
  setTheme(theme: Theme): void;
  setPalette(palette: PaletteId): void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * The theme, with the same precedence as the language: the choice made on this
 * device wins, the account's stored preference is the fallback for a device that
 * has not chosen, and `system` is the answer when neither exists.
 *
 * The provider sits inside `SessionProvider` so the account preference is already
 * available on the first render; saving is fire-and-forget because the interface
 * has already changed, which is what the person asked for.
 */
export function ThemeProvider({ children }: { children: ReactNode }): ReactElement {
  const { user } = useSession();
  const [theme, setThemeState] = useState<Theme>(() => readStored() ?? 'system');
  const [palette, setPaletteState] = useState<PaletteId>(() => readStoredPalette());

  const apply = useCallback((t: Theme) => {
    const r = resolve(t);
    document.documentElement.setAttribute('data-theme', r);
    // Keep the media-query fallback in sync for components that read it.
    document.documentElement.style.colorScheme = r;
  }, []);

  useEffect(() => {
    apply(theme);
  }, [theme, apply]);

  // The paper is one attribute beside the mode; `white` removes it, because the
  // default look is `:root` and a device that never chose needs no migration.
  useEffect(() => {
    const root = document.documentElement;
    if (palette === 'white') root.removeAttribute('data-palette');
    else root.setAttribute('data-palette', palette);
  }, [palette]);

  // A signed-in account's stored preference wins on load, but only when this
  // device has no choice of its own.
  useEffect(() => {
    if (!user) return;
    if (readStored() === null && isTheme(user.theme)) setThemeState(user.theme);
  }, [user]);

  // React to system preference changes when in 'system' mode.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') apply(theme);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, apply]);

  const setTheme = useCallback(
    (next: Theme) => {
      if (!isTheme(next) || next === theme) return;
      setThemeState(next);
      writeStored(next);
      if (!user) return;
      void api('/me', { method: 'PATCH', body: { user: { theme: next } } }).catch(() => {
        // The interface already switched; only the saved preference failed. It is
        // retried the next time the person changes the theme.
      });
    },
    [theme, user],
  );

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      resolved: resolve(theme),
      palette,
      setTheme,
      setPalette: (next: PaletteId) => {
        if (!isPalette(next) || next === palette) return;
        setPaletteState(next);
        writeStoredPalette(next);
      },
    }),
    [theme, palette, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
