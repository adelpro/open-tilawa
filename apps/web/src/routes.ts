import { SURAH_NAMES_EN } from '@/i18n/surah-names-en';

/**
 * The one place a path exists.
 *
 * The router, the prerender script, the sitemap and the tests all read this table, so a
 * route that is not here cannot be reached, cannot be prerendered and cannot be indexed.
 * Nothing else in the app builds a URL by string concatenation.
 *
 * `index` decides whether a crawler may rank the page; `sitemap` whether it is announced.
 * They are two questions with one answer today — the test `every indexable route is in the
 * sitemap` keeps it that way — but they are separate columns because `/listen` pages are
 * prerendered for their share cards while staying out of the index.
 *
 * The hub rows (`/surahs`, `/reciters` and their detail paths) resolve and prerender, but
 * the screen behind them is still the player, so they are not announced: a sitemap that
 * lists 126 URLs rendering the same document is the fastest way to teach a crawler that
 * this site has no pages. They flip to `index: true` in the commit that ships the hub
 * screens, and `test/routes.test.ts` fails until then, on purpose.
 *
 * Numeric identity, name as decoration: `/listen/minshawi/18-al-kahf` is the surah 18 page
 * whatever the second segment says, and `toPath` writes the current name so a stale one can
 * be redirected to it.
 */

export type RouteName =
  | 'home'
  | 'listen'
  | 'reciters'
  | 'reciter'
  | 'surahs'
  | 'surah'
  | 'about'
  | 'privacy'
  | 'account'
  | 'settings'
  | 'favorites'
  | 'recent'
  | 'notFound';

export type Parsed =
  | { name: 'listen'; release: string; surah: number; surahName: string }
  | { name: 'reciter'; release: string }
  | { name: 'surah'; surah: number; surahName: string }
  | { name: Exclude<RouteName, 'listen' | 'reciter' | 'surah'> };

export type RouteRow = {
  name: RouteName;
  /** Path template, for readers of the table. Params are `{release}` and `{n}`. */
  pattern: string;
  index: boolean;
  sitemap: boolean;
  prerender: boolean;
};

export const ROUTE_TABLE: readonly RouteRow[] = [
  { name: 'home', pattern: '/', index: true, sitemap: true, prerender: true },
  { name: 'listen', pattern: '/listen/{release}/{n}-{surah}', index: false, sitemap: false, prerender: true },
  { name: 'reciters', pattern: '/reciters', index: false, sitemap: false, prerender: true },
  { name: 'reciter', pattern: '/reciters/{release}', index: false, sitemap: false, prerender: true },
  { name: 'surahs', pattern: '/surahs', index: false, sitemap: false, prerender: true },
  { name: 'surah', pattern: '/surahs/{n}-{surah}', index: false, sitemap: false, prerender: true },
  { name: 'about', pattern: '/about', index: true, sitemap: true, prerender: true },
  { name: 'privacy', pattern: '/privacy', index: true, sitemap: true, prerender: true },
  { name: 'account', pattern: '/account', index: false, sitemap: false, prerender: false },
  { name: 'settings', pattern: '/settings', index: false, sitemap: false, prerender: false },
  { name: 'favorites', pattern: '/favorites', index: false, sitemap: false, prerender: false },
  { name: 'recent', pattern: '/recent', index: false, sitemap: false, prerender: false },
] as const;

const STATIC: ReadonlySet<string> = new Set(
  ROUTE_TABLE.filter((row) => !row.pattern.includes('{')).map((row) => row.pattern),
);

/** Mushaf bounds. A number outside it is a typo, not a page. */
const MIN_SURAH = 1;
const MAX_SURAH = 114;

/** `Al-Kahf` → `al-kahf`, `An-Nisa'` → `an-nisa`. */
export function slugifySurahName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function surahSlug(id: number): string {
  return slugifySurahName(SURAH_NAMES_EN[id] ?? '');
}

function validSurah(raw: string | undefined): number | null {
  if (!raw) return null;
  const leading = raw.match(/^(\d+)/);
  if (!leading) return null;
  const id = Number(leading[1]);
  return Number.isInteger(id) && id >= MIN_SURAH && id <= MAX_SURAH ? id : null;
}

/** Splits `18-al-kahf` into `{ id: 18, name: 'al-kahf' }`; the name may be absent. */
function surahSegment(segment: string | undefined): { id: number; name: string } | null {
  const id = validSurah(segment);
  if (id === null) return null;
  const name = segment?.replace(/^\d+-?/, '') ?? '';
  return { id, name };
}

export function parse(pathname: string): Parsed {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';

  if (STATIC.has(path)) return { name: path === '/' ? 'home' : (path.slice(1) as Parsed['name']) } as Parsed;

  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'listen' && segments.length === 3) {
    const surah = surahSegment(segments[2]);
    if (!surah || !segments[1]) return { name: 'notFound' };
    return { name: 'listen', release: segments[1], surah: surah.id, surahName: surah.name };
  }

  if (segments[0] === 'reciters' && segments.length === 2) {
    return { name: 'reciter', release: segments[1] };
  }

  if (segments[0] === 'surahs' && segments.length === 2) {
    const surah = surahSegment(segments[1]);
    if (!surah) return { name: 'notFound' };
    return { name: 'surah', surah: surah.id, surahName: surah.name };
  }

  return { name: 'notFound' };
}

/** The canonical form. Always writes the current surah name, never the one it was given. */
export function toPath(route: Parsed): string {
  switch (route.name) {
    case 'listen':
      return `/listen/${route.release}/${route.surah}-${surahSlug(route.surah)}`;
    case 'reciter':
      return `/reciters/${route.release}`;
    case 'surah':
      return `/surahs/${route.surah}-${surahSlug(route.surah)}`;
    case 'home':
      return '/';
    default:
      return `/${route.name}`;
  }
}

export function isKnown(pathname: string): boolean {
  return parse(pathname).name !== 'notFound';
}

/**
 * The one-time migration from the hash router.
 *
 * Bookmarks and installed shortcuts still say `#/about` or `#/?view=favorites`.
 * Rewriting them through `replaceState` means the old URL never reaches the history
 * stack, so Back does not bounce between the two forms. Anything that does not start
 * with `#/` is not ours and returns null.
 */
export function legacyHashToPath(hash: string): string | null {
  if (!hash.startsWith('#/')) return null;
  const [path, query] = hash.slice(1).split('?');
  const favourites = path === '/' && new URLSearchParams(query).get('view') === 'favorites';
  const target = favourites ? '/favorites' : path;
  return query ? `${target}?${query}` : target;
}
