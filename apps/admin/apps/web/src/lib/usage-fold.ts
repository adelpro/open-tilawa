/**
 * Which Usage panels are folded, kept per browser.
 *
 * The same trade as the nav: a layout preference belongs to this screen and this
 * device, so it lives in localStorage next to the theme. It applies before the
 * summary arrives and needs no request. A missing, partial or corrupt value opens
 * every panel — an empty usage page is never the failure mode.
 *
 * One key for the whole page, not one per panel: a single read and a single write,
 * and a panel added later simply starts open.
 */
export const USAGE_PANELS = [
  'surahs',
  'reciters',
  'source',
  'volume',
  'devices',
  'errors',
  'recent',
] as const;

export type UsagePanel = (typeof USAGE_PANELS)[number];

export type Folded = Record<UsagePanel, boolean>;

export const DEFAULT_FOLDED: Folded = {
  surahs: false,
  reciters: false,
  source: false,
  volume: false,
  devices: false,
  errors: false,
  recent: false,
};

const STORAGE_KEY = 'tilawa.usage.folded';

export function readFolded(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): Folded {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FOLDED };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_FOLDED };
    const value = parsed as Record<string, unknown>;
    // Only an explicit `true` folds a panel; everything else is open.
    return Object.fromEntries(
      USAGE_PANELS.map((panel) => [panel, value[panel] === true]),
    ) as Folded;
  } catch {
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
