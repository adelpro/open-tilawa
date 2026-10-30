import type { Messages } from '@/i18n/messages';
import type { Parsed } from '@/routes';

/**
 * The tab title, from one place.
 *
 * The player owns most of them: a listener reading `/about` still has a recitation
 * loaded, and the tab is the only screen that carries its name while they are elsewhere.
 * A page that is *not* the player owns its own title, and it is the same string the
 * prerender step wrote into that page's HTML — hydration must not rename the document a
 * crawler already read.
 *
 * Returns `null` for every route the player answers (home, `/listen`, and the hub rows
 * that still render the player), which is the caller's signal to name what is playing.
 */
export function pageTitle(route: Parsed, t: Messages): string | null {
  switch (route.name) {
    case 'reciters':
      return `${t.routes.reciters} — Tilawah`;
    case 'about':
      return `${t.routes.about} — Tilawah`;
    case 'privacy':
      return `${t.routes.privacy} — Tilawah`;
    case 'settings':
      return `${t.routes.settings} — Tilawah`;
    case 'notFound':
      return `${t.notFound.title} — Tilawah`;
    default:
      return null;
  }
}

/** What the tab says: the page's own title, or the surah the player is holding. */
export function documentTitle(route: Parsed, t: Messages, surahName: string): string {
  return pageTitle(route, t) ?? (surahName ? `${surahName} — Tilawah` : 'Tilawah');
}
