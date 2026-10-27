import { useCallback, useState } from 'react';

export type SheetKind = 'surahs' | 'reciters' | 'stream' | 'keys';

const PIN_KEY = 'tilawa.pinned.v1';

function readPin(): boolean {
  try {
    return window.localStorage.getItem(PIN_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Which panel is up, and whether it is pinned.
 *
 * Pinned means the docked list survives picking a row — the panel is furniture
 * on a large screen, not a dialog you dismiss. The choice is remembered, so a
 * desktop listener who pins the reciter list gets it back on the next visit.
 */
export function useSheet() {
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [pinned, setPinned] = useState(readPin);

  const openSurahs = useCallback(() => setSheet('surahs'), []);
  const openReciters = useCallback(() => setSheet('reciters'), []);
  const openStream = useCallback(() => setSheet('stream'), []);
  const openKeys = useCallback(() => setSheet('keys'), []);

  const close = useCallback(() => setSheet(null), []);

  const togglePin = useCallback(() => {
    setPinned((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(PIN_KEY, next ? '1' : '0');
      } catch {
        // A blocked store costs the preference, not the panel.
      }
      return next;
    });
  }, []);

  return { sheet, pinned, togglePin, openSurahs, openReciters, openStream, openKeys, close };
}
