/**
 * Which Settings panels are folded, kept per browser.
 *
 * The same trade as the Usage fold: a layout preference belongs to this screen
 * and this device, so it lives in localStorage next to the theme. One key for
 * the page, read before the data arrives, and only an explicit `true` folds —
 * a corrupt or partial value never hides a settings panel.
 */
export const STORAGE_KEY = 'tilawa.settings.folds';

export type SettingsFolds = { recentAlerts: boolean };

export const DEFAULT_SETTINGS_FOLDS: SettingsFolds = { recentAlerts: false };

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

export function readFolds(storage: Reader = window.localStorage): SettingsFolds {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS_FOLDS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SETTINGS_FOLDS };
    const value = parsed as Record<string, unknown>;
    return { recentAlerts: value.recentAlerts === true };
  } catch {
    return { ...DEFAULT_SETTINGS_FOLDS };
  }
}

export function writeFolds(
  value: SettingsFolds,
  storage: Partial<Reader & Writer> = window.localStorage,
): void {
  try {
    storage.setItem?.(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The fold still applies to this session; only the memory is lost.
  }
}
