/**
 * A reciter as the player needs them: the catalogue row id (the key saved
 * positions use), the name to show, the magnet to announce, the reading, and
 * whether the release carries the whole book.
 *
 * There is no source badge and no fallback playlist here — the fallback is a
 * property of the running torrent (see `use-torrent`), not of the reciter.
 */
export type Reciter = {
  id: number;
  name: string;
  magnet: string;
  riwaya: string;
  complet: boolean;
};
