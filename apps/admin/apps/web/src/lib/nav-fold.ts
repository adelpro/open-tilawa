/**
 * Which navigation categories are folded, kept per browser.
 *
 * The categories are the nav's own groups (Workspace, Management). The state is a
 * preference, not data: it belongs to this screen and this device, so it lives in
 * localStorage next to the theme — no request, no schema, and it works while the
 * session is still loading. An account-synced version can replace these two
 * functions later without touching the nav.
 *
 * A missing or corrupt value is "both open", never a blank sidebar. A rename of
 * the key loses the preference and nothing else.
 */
export type NavGroup = 'workspace' | 'admin';

export type Folded = Record<NavGroup, boolean>;

export const DEFAULT_FOLDED: Folded = { workspace: false, admin: false };

const STORAGE_KEY = 'tilawa.nav.folded';

export function readFolded(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): Folded {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FOLDED };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_FOLDED };
    const value = parsed as Record<string, unknown>;
    // Only an explicit `true` folds a group. A partial object or a typo opens it.
    return { workspace: value.workspace === true, admin: value.admin === true };
  } catch {
    // Private mode, disabled storage, or a value written by an older build.
    return { ...DEFAULT_FOLDED };
  }
}

export function writeFolded(
  value: Folded,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The fold still applies to this session; only the memory is lost.
  }
}
