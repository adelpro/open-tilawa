import { atom, useAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';

import { loadState, patchSettings } from '@/hooks/use-persistence';
import { isPalette, type PaletteId } from '@/utils/palettes';

export type Theme = 'light' | 'dark';

// Seeded from storage for the same reason as the locale: main.tsx paints first,
// and an atom default would undo it on mount.
export const themeAtom = atom<Theme>(resolveInitialTheme());
export const paletteAtom = atom<PaletteId>(resolveInitialPalette());

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

/**
 * A device that never chose a paper is on the original one — which is why the
 * absence of the value, and not a written default, is what older installs have.
 */
export function resolveInitialPalette(): PaletteId {
  const raw = typeof window === 'undefined' ? undefined : loadState().settings.palette;
  return isPalette(raw) ? raw : 'default';
}

/**
 * The status bar belongs to the screen, not to the browser: a white strip over
 * a black page reads as a rendering bug. Read the token back after the palette
 * is applied so the two can never drift apart.
 */
function repaintThemeColor(): void {
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && background) meta.setAttribute('content', background);
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  repaintThemeColor();
}

/**
 * The paper is one attribute beside the mode, so the palette and the mode stay
 * two decisions rather than N combinations. `default` removes the attribute,
 * because `:root` is already that paper: an old device needs no migration and
 * a new one needs no block.
 */
export function applyPalette(palette: PaletteId): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (palette === 'default') delete root.dataset.palette;
  else root.dataset.palette = palette;
  repaintThemeColor();
}

/**
 * The palette is one attribute on <html>, so the switch can cross-fade instead
 * of flashing. Rare, deliberate action: the one place the app is allowed a
 * full-page transition. The `adopt*` setters stay instant — they arrive from
 * the ring at load, and animating a colour nobody asked for is a flash with
 * extra steps.
 */
function crossfade(commit: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> };
  };

  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    typeof doc.startViewTransition !== 'function'
  ) {
    commit();
  } else {
    doc.startViewTransition(commit);
  }
}

/** One attribute on <html>; the palette does the rest. */
export function useTheme(): {
  theme: Theme;
  palette: PaletteId;
  setTheme: (next: Theme) => void;
  setPalette: (next: PaletteId) => void;
  adoptTheme: (next: Theme) => void;
  adoptPalette: (next: PaletteId) => void;
} {
  const [theme, setThemeAtom] = useAtom(themeAtom);
  const [palette, setPaletteAtom] = useAtom(paletteAtom);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  const setTheme = (next: Theme) => {
    crossfade(() => {
      // flushSync, not a bare setter: the new snapshot is taken when this
      // returns, so React's commit has to be inside it or the chips lag a frame.
      flushSync(() => setThemeAtom(next));
      applyTheme(next);
    });

    patchSettings({ theme: next });
  };

  const setPalette = (next: PaletteId) => {
    crossfade(() => {
      flushSync(() => setPaletteAtom(next));
      applyPalette(next);
    });

    patchSettings({ palette: next });
  };

  /** Same contract as `adoptLocale`: apply without writing back to the ring. */
  const adoptTheme = useCallback(
    (next: Theme) => {
      setThemeAtom(next);
      applyTheme(next);
    },
    [setThemeAtom],
  );

  const adoptPalette = useCallback(
    (next: PaletteId) => {
      setPaletteAtom(next);
      applyPalette(next);
    },
    [setPaletteAtom],
  );

  return { theme, palette, setTheme, setPalette, adoptTheme, adoptPalette };
}
