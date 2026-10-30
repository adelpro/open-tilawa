import { MESSAGES } from '../i18n/messages';

/**
 * The install prompt's shopfront.
 *
 * Five captures of the real app: three phone (Chrome shows up to five, so more
 * is noise) and two desktop, because `form_factor: 'wide'` is what turns the
 * desktop install dialog from a title and an icon into a preview. About and
 * Privacy are deliberately absent — they are text pages and they sell nothing.
 *
 * `sizes` must equal the PNG's own pixel dimensions: Chrome drops a mismatched
 * entry silently. `test/pwa-manifest.test.ts` reads the file headers, so a
 * re-capture at a new viewport fails the suite instead of the manifest.
 *
 * Regularised by `scripts/screenshots.mjs`. Labels come from the app's own
 * copy — the manifest is Arabic-first, like the document it describes.
 */
export type PwaScreenshot = {
  src: string;
  sizes: `${number}x${number}`;
  type: 'image/png';
  form_factor: 'narrow' | 'wide';
  label: string;
};

export type PwaShortcut = {
  name: string;
  short_name: string;
  url: string;
  icons: { src: string; sizes: string; type: 'image/png' }[];
};

const ar = MESSAGES.ar;

export const PWA_SCREENSHOTS: PwaScreenshot[] = [
  {
    src: '/screenshots/player-narrow.png',
    sizes: '1080x1920',
    type: 'image/png',
    form_factor: 'narrow',
    label: ar.routes.listen,
  },
  {
    src: '/screenshots/reciters-narrow.png',
    sizes: '1080x1920',
    type: 'image/png',
    form_factor: 'narrow',
    label: ar.keys.reciters,
  },
  {
    src: '/screenshots/settings-narrow-dark.png',
    sizes: '1080x1920',
    type: 'image/png',
    form_factor: 'narrow',
    label: `${ar.routes.settings} — ${ar.settings.dark}`,
  },
  {
    src: '/screenshots/player-wide.png',
    sizes: '1920x1080',
    type: 'image/png',
    form_factor: 'wide',
    label: ar.routes.listen,
  },
  {
    src: '/screenshots/settings-wide.png',
    sizes: '1920x1080',
    type: 'image/png',
    form_factor: 'wide',
    label: ar.routes.settings,
  },
];

/**
 * Long-press on the launcher icon. Two entries, both real pages the router
 * knows: the listener's own list and settings. They used to carry a query
 * inside the hash; they are paths now, so no personal state reaches an access
 * log and the app does not have to redirect a shortcut on every cold start.
 */
export const PWA_SHORTCUTS: PwaShortcut[] = [
  {
    name: ar.sheets.myFavorites,
    short_name: ar.sheets.myFavorites,
    url: '/favorites',
    icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  {
    name: ar.routes.settings,
    short_name: ar.routes.settings,
    url: '/settings',
    icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
];
