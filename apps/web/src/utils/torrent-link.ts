/**
 * The magnet as an `href`, or nothing.
 *
 * A magnet is inert text until it is put in a link, and then it is a navigation
 * primitive the browser hands to the operating system. The string comes from the
 * catalogue, which the console can edit, so a stored `javascript:` or `data:`
 * must never reach that handler. Only `magnet:?…` leaves here.
 */
export function torrentLinkHref(magnet: string | null | undefined): string | null {
  const value = magnet?.trim();
  if (!value) return null;
  const prefix = 'magnet:?';
  return value.startsWith(prefix) && value.length > prefix.length ? value : null;
}
