import { useCallback, useState } from 'react';

export type SheetKind = 'surahs' | 'reciters' | 'menu' | 'about' | 'privacy';

/**
 * Which sheet is up. Local state, not a route: changing what is open must not
 * look like navigation. Opening a sheet replaces the current one, so the menu
 * and the page it links to are never stacked.
 */
export function useSheet() {
  const [sheet, setSheet] = useState<SheetKind | null>(null);

  return {
    sheet,
    open: useCallback((kind: SheetKind) => setSheet(kind), []),
    close: useCallback(() => setSheet(null), []),
  };
}
