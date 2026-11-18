import type { Parsed } from '@/routes';

export type SheetKind = 'surahs' | 'reciters' | 'stream' | 'keys';

export type PanelSnapshot = {
  sheet: SheetKind | null;
  accountOpen: boolean;
  menuOpen: boolean;
};

export type SheetOpenPlan = PanelSnapshot & {
  navigateTo: Parsed | null;
};

const NON_PLAYER_ROUTES = new Set([
  'reciters',
  'reciter',
  'about',
  'seed',
  'extension',
  'privacy',
  'notFound',
  'settings',
]);

/**
 * Whether `<PlayerPage>` is mounted for this route.
 *
 * The surahs, reciters, stream, and shortcuts panels live inside `<PlayerPage>`,
 * so opening one from the top bar on another screen (such as `/reciters/<slug>`
 * or `/settings`) must navigate home alongside setting the active sheet.
 */
export function isPlayerScreen(route: Parsed, deepLinkMissing = false): boolean {
  if (deepLinkMissing) return false;
  return !NON_PLAYER_ROUTES.has(route.name);
}

/**
 * Canonical identity for detecting real screen transitions while ignoring
 * decorative surah-slug canonicalisation on `/listen/<release>/<surah>`.
 */
export function routeIdentity(route: Parsed): string {
  if (route.name === 'listen') return `listen:${route.release}:${route.surah}`;
  if (route.name === 'reciter') return `reciter:${route.slug}`;
  return route.name;
}

/** Plan opening a player sheet without leaving overlapping overlays behind. */
export function planOpenPlayerSheet(
  kind: SheetKind,
  route: Parsed,
  deepLinkMissing = false,
): SheetOpenPlan {
  return {
    sheet: kind,
    accountOpen: false,
    menuOpen: false,
    navigateTo: isPlayerScreen(route, deepLinkMissing) ? null : { name: 'home' },
  };
}

/** Plan opening the account sheet while dismissing any stacked sheet or nav menu. */
export function planOpenAccountPanel(): PanelSnapshot {
  return { sheet: null, accountOpen: true, menuOpen: false };
}

/** Plan clearing overlays on top-bar navigation; pinned player sheets stay open. */
export function planLeaveOverlays(currentSheet: SheetKind | null, pinned: boolean): PanelSnapshot {
  return {
    sheet: pinned ? currentSheet : null,
    accountOpen: false,
    menuOpen: false,
  };
}
