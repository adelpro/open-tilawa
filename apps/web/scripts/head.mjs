/**
 * The shell's head, minus the copy.
 *
 * `prerender.mjs` replaces the whole `<head>` with the words a crawler came for, and
 * for a year it kept only the script and the stylesheet. Everything Vite had put
 * there went with it: the manifest link the PWA plugin injects, the window chrome,
 * the launcher icon, the favicons, the font preloads. The site served a valid
 * manifest that no document referenced, so Chrome offered no install and "Add to
 * Home screen" was a bookmark.
 *
 * So the tags that are not copy are carried over by pattern, not retyped. A page
 * that wants its own theme colour can still write one; this list only keeps what
 * the build already emitted.
 */
const KEEP = [
  /^<link[^>]+rel="manifest"[^>]*>$/,
  /^<link[^>]+rel="apple-touch-icon"[^>]*>$/,
  /^<link[^>]+rel="icon"[^>]*>$/,
  /^<link[^>]+rel="preload"[^>]*>$/,
  /^<meta[^>]+name="theme-color"[^>]*>$/,
  /^<meta[^>]+name="text-scale"[^>]*>$/,
  // The image's own dimensions are the same on every page; its URL and alt are not,
  // and `page()` writes those from the page it is writing.
  /^<meta[^>]+property="og:image:(type|width|height|alt)"[^>]*>$/,
];

/**
 * The tags to carry from `shell` into a prerendered head.
 *
 * `[^>]` spans newlines, so a tag Vite left wrapped across lines is still matched
 * whole. Order is the shell's, which is the order the browser already saw.
 */
export function shellHeadTags(shell) {
  return [...shell.matchAll(/<(?:link|meta)\b[^>]*>/g)]
    .map((match) => match[0].trim())
    .filter((tag) => KEEP.some((pattern) => pattern.test(tag)));
}
