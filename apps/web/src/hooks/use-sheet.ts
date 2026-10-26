import { useState } from 'react';

export type SheetKind = 'surahs' | 'reciters' | null;

/**
 * Which sheet is up. Local state, not a route: changing what is open must not
 * look like navigation, and the back button belongs to the browser history the
 * listener arrived from.
 */
export function useSheet() {
  const [sheet, setSheet] = useState<SheetKind>(null);

  return {
    sheet,
    openSurahs: () => setSheet('surahs'),
    openReciters: () => setSheet('reciters'),
    close: () => setSheet(null),
  };
}
