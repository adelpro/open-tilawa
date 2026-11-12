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
  /** The name the Arabic screen shows: the catalogue's `nameAr`. */
  name: string;
  /**
   * The name the English screen shows, from the release's own latin name. Kept beside
   * the Arabic one instead of replacing it: sorting, search and the saved-position key
   * are Arabic-first, and only the rendered label changes with the language.
   */
  nameEn: string;
  magnet: string;
  riwaya: string;
  complet: boolean;
  /**
   * The surahs the release carries, from the catalogue's import manifest.
   * Null means the catalogue does not know; the app then offers the whole book,
   * as it did before the column existed.
   */
  surahs: number[] | null;
  /**
   * Bytes the release weighs, from the catalogue; null when the row omits it.
   * The seed page states what a copy costs, so this travels with the roster.
   */
  sizeBytes: number | null;
  /**
   * The public face of the release, assigned by the catalogue and frozen there.
   * Empty when the catalogue has not assigned one yet — the row stays playable, it
   * simply has no `/listen/...` URL, because this app never derives a slug itself.
   */
  slug: string;
};
