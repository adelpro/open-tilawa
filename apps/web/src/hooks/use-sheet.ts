import { useCallback, useState } from 'react';

export type SheetKind = 'surahs' | 'reciters' | 'stream';

/**
 * Which sheet is up. Local state, not a route: what is open must not look like
 * navigation. The stream readout is a sheet like the lists, so there is one
 * dismissal pattern on the page.
 */
export function useSheet() {
  const [sheet, setSheet] = useState<SheetKind | null>(null);

  return {
    sheet,
    openSurahs: useCallback(() => setSheet('surahs'), []),
    openReciters: useCallback(() => setSheet('reciters'), []),
    openStream: useCallback(() => setSheet('stream'), []),
    close: useCallback(() => setSheet(null), []),
  };
}
