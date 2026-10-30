/**
 * Local persistence, v3.
 *
 * One key, one shape, one write path. The v1 layout (`{ reciterId, surahIndex,
 * position }`) clobbered the previous reciter's position; v2 kept a per-reciter
 * map but grew settings fields one by one at the top level. v3 groups them, so
 * "what the listener chose" and "where they were" are separable and both can be
 * migrated on their own.
 *
 * Nothing here writes on `timeupdate`: position is debounced, and flushed when
 * playback pauses, when the surah changes and when the page goes away.
 */

import { LOCALES, type Locale } from '@/i18n/messages';
import { VISUALISERS, type Visualiser } from '@/utils/visualiser-models';
import { STORAGE_KEYS } from '@/utils/storage-keys';

export const STORAGE_KEY = STORAGE_KEYS.state;
const PREVIOUS_KEY = STORAGE_KEYS.statePrevious;
const LEGACY_KEY = 'tilawa:state';
const LEGACY_PROGRESS_PREFIX = 'tilawa:progress:';
const MAX_POSITIONS = 10;
const POSITION_WRITE_DELAY = 2_000;

export type StoredPosition = {
  /** 1–114. Note: v1 stored a 0-based playlist index; the migration shifts it. */
  surahId: number;
  position: number;
  updatedAt: number;
};

export type StoredSettings = {
  rate?: number;
  visualiser?: string;
  locale?: string;
  theme?: string;
  /**
   * When this device last changed a setting, in ms. Cross-device sync compares
   * it so a late relay echo cannot undo a newer local choice. Absent in states
   * written before settings synced, which read as "oldest".
   */
  updatedAt?: number;
};

/**
 * The speeds the settings screen offers. A remote value outside this list is a
 * bad write, not a speed the player supports.
 */
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

const THEMES = ['light', 'dark'] as const;

/** A wrong clock must not win forever: stamps this far ahead are ignored. */
const MAX_CLOCK_SKEW = 60_000;

/** The strict shape a remote payload has to earn before it reaches the atoms. */
export type ResolvedSettings = {
  rate?: number;
  visualiser?: Visualiser;
  locale?: Locale;
  theme?: (typeof THEMES)[number];
  updatedAt: number;
};

export type StoredState = {
  version: 3;
  reciterId?: number;
  /** The surah the listener last selected, before any position is written. */
  lastSurahId?: number;
  positions: Record<string, StoredPosition>;
  settings: StoredSettings;
  updatedAt: number;
};

export const DEFAULT_STATE: StoredState = {
  version: 3,
  positions: {},
  settings: {},
  updatedAt: 0,
};

type LegacyState = {
  reciterId?: number;
  surahIndex?: number;
  position?: number;
  updatedAt?: number;
};

type LegacyProgress = { surahIndex?: number; position?: number; updatedAt?: number };

type V2State = {
  version?: unknown;
  reciterId?: unknown;
  positions?: unknown;
  rate?: unknown;
  visualiser?: unknown;
  locale?: unknown;
  theme?: unknown;
  updatedAt?: unknown;
};

function toPosition(surahIndex: number, position: number, updatedAt: number): StoredPosition {
  return { surahId: surahIndex + 1, position: Math.max(0, position || 0), updatedAt };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * v3 settings keep their own stamp; v2's `updatedAt` was the whole state's
 * (bumped by position writes), so it must not be mistaken for a settings stamp
 * and outrank the account's.
 */
function storedSettings(source: unknown): StoredSettings {
  const raw = (source && typeof source === 'object' ? source : {}) as Record<string, unknown>;
  const settings = settingsOf(raw);
  const stamp = numberOrUndefined(raw.updatedAt);
  if (stamp !== undefined) settings.updatedAt = stamp;
  return settings;
}

function settingsOf(source: {
  rate?: unknown;
  visualiser?: unknown;
  locale?: unknown;
  theme?: unknown;
}): StoredSettings {
  const settings: StoredSettings = {
    rate: numberOrUndefined(source.rate),
    visualiser: stringOrUndefined(source.visualiser),
    locale: stringOrUndefined(source.locale),
    theme: stringOrUndefined(source.theme),
  };
  // Drop absent keys so the blob stays readable in devtools.
  (Object.keys(settings) as (keyof StoredSettings)[]).forEach((key) => {
    if (settings[key] === undefined) delete settings[key];
  });
  return settings;
}

/** v2 → v3: settings move into their own bag, everything else is preserved. */
export function migrateV2(raw: unknown): StoredState | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as V2State;
  if (value.version !== 2) return null;

  const positions =
    value.positions && typeof value.positions === 'object'
      ? (value.positions as Record<string, StoredPosition>)
      : {};

  const lastReciter = numberOrUndefined(value.reciterId);
  const saved = lastReciter !== undefined ? positions[String(lastReciter)] : undefined;

  return {
    version: 3,
    reciterId: lastReciter,
    lastSurahId: saved?.surahId,
    positions,
    settings: settingsOf(value),
    updatedAt: numberOrUndefined(value.updatedAt) ?? 0,
  };
}

/**
 * Pure migration so it can be tested: given whatever the browser holds, return
 * a valid state. Unknown shapes degrade to defaults — never throw.
 */
export function migrateLegacy(
  legacy: LegacyState | null,
  progress: Record<string, LegacyProgress>,
): StoredState {
  const positions: Record<string, StoredPosition> = {};

  for (const [reciterId, entry] of Object.entries(progress)) {
    if (typeof entry?.surahIndex !== 'number') continue;
    positions[reciterId] = toPosition(entry.surahIndex, entry.position ?? 0, entry.updatedAt ?? 0);
  }

  if (legacy && typeof legacy.surahIndex === 'number' && legacy.reciterId !== undefined) {
    positions[String(legacy.reciterId)] = toPosition(
      legacy.surahIndex,
      legacy.position ?? 0,
      legacy.updatedAt ?? 0,
    );
  }

  const reciterId = numberOrUndefined(legacy?.reciterId);
  const saved = reciterId !== undefined ? positions[String(reciterId)] : undefined;

  return {
    version: 3,
    reciterId,
    lastSurahId: saved?.surahId,
    positions,
    settings: {},
    updatedAt: 0,
  };
}

export function isStoredState(value: unknown): value is StoredState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as StoredState;
  return candidate.version === 3 && typeof candidate.positions === 'object';
}

function readRaw(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadState(): StoredState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };

  try {
    const current = readRaw(STORAGE_KEY);
    if (current) {
      const parsed: unknown = JSON.parse(current);
      if (isStoredState(parsed)) {
        return {
          version: 3,
          reciterId: numberOrUndefined(parsed.reciterId),
          lastSurahId: numberOrUndefined(parsed.lastSurahId),
          positions: parsed.positions ?? {},
          settings: storedSettings(parsed.settings),
          updatedAt: numberOrUndefined(parsed.updatedAt) ?? 0,
        };
      }
    }

    // v2: same key family, settings at the top level.
    const previous = readRaw(PREVIOUS_KEY);
    if (previous) {
      const migrated = migrateV2(JSON.parse(previous));
      if (migrated) {
        saveState(migrated);
        return migrated;
      }
    }

    const legacyRaw = readRaw(LEGACY_KEY);
    const legacy: LegacyState | null = legacyRaw ? JSON.parse(legacyRaw) : null;

    const progress: Record<string, LegacyProgress> = {};
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(LEGACY_PROGRESS_PREFIX)) continue;
      const id = key.slice(LEGACY_PROGRESS_PREFIX.length);
      try {
        progress[id] = JSON.parse(window.localStorage.getItem(key) || '{}');
      } catch {
        // one corrupt entry must not lose the rest
      }
    }

    if (!legacy && Object.keys(progress).length === 0) return { ...DEFAULT_STATE };

    const migrated = migrateLegacy(legacy, progress);
    saveState(migrated);
    window.localStorage.removeItem(LEGACY_KEY);
    for (const key of Object.keys(progress)) {
      window.localStorage.removeItem(`${LEGACY_PROGRESS_PREFIX}${key}`);
    }
    return migrated;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(next: StoredState): StoredState {
  if (typeof window === 'undefined') return next;
  try {
    const trimmed = trimPositions(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch {
    // private mode / quota — degrade gracefully
    return next;
  }
}

/** Keep the newest MAX_POSITIONS entries so the map cannot grow forever. */
export function trimPositions(state: StoredState): StoredState {
  const entries = Object.entries(state.positions);
  if (entries.length <= MAX_POSITIONS) return state;
  entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  return { ...state, positions: Object.fromEntries(entries.slice(0, MAX_POSITIONS)) };
}

export function patchState(patch: Partial<Omit<StoredState, 'version'>>): StoredState {
  const current = loadState();
  return saveState({ ...current, ...patch, version: 3, updatedAt: Date.now() });
}

/**
 * Decide whether the account's settings should replace this device's.
 *
 * Pure and total: a malformed relay payload degrades to "nothing to apply".
 * `now` is a parameter so the clock-skew rule is testable without faking time.
 */
export function resolveRemoteSettings(
  local: StoredSettings,
  remote: unknown,
  now: number = Date.now(),
): ResolvedSettings | null {
  if (!remote || typeof remote !== 'object') return null;

  const source = remote as Record<string, unknown>;
  const stamp = numberOrUndefined(source.updatedAt) ?? 0;
  const localStamp = numberOrUndefined(local.updatedAt) ?? 0;

  // Not strictly newer: the stamp this device just wrote is about to echo back.
  if (stamp <= localStamp) return null;
  if (stamp > now + MAX_CLOCK_SKEW) return null;

  const resolved: ResolvedSettings = { updatedAt: stamp };

  const rate = numberOrUndefined(source.rate);
  if (rate !== undefined && (PLAYBACK_RATES as readonly number[]).includes(rate)) {
    resolved.rate = rate;
  }
  if (typeof source.visualiser === 'string' && (VISUALISERS as readonly string[]).includes(source.visualiser)) {
    resolved.visualiser = source.visualiser as Visualiser;
  }
  if (typeof source.locale === 'string' && (LOCALES as readonly string[]).includes(source.locale)) {
    resolved.locale = source.locale as Locale;
  }
  if (typeof source.theme === 'string' && (THEMES as readonly string[]).includes(source.theme)) {
    resolved.theme = source.theme as (typeof THEMES)[number];
  }

  // A stamp with no usable field is not worth a re-render.
  return Object.keys(resolved).length > 1 ? resolved : null;
}

/**
 * The other half of last-write-wins: a device that changed a setting offline
 * holds the newest value, so login has to push it instead of quietly dropping
 * it. A missing local stamp means "this device never chose anything" — its
 * defaults must not overwrite the account.
 */
export function shouldPushLocalSettings(
  local: StoredSettings,
  remote: unknown,
  now: number = Date.now(),
): boolean {
  const localStamp = numberOrUndefined(local.updatedAt) ?? 0;
  if (localStamp === 0) return false;
  if (localStamp > now + MAX_CLOCK_SKEW) return false;

  const remoteStamp =
    remote && typeof remote === 'object'
      ? numberOrUndefined((remote as Record<string, unknown>).updatedAt) ?? 0
      : 0;

  return localStamp > remoteStamp;
}

/**
 * Adopt settings that came from the account.
 *
 * Deliberately does **not** dispatch `STORAGE_EVENT`: that event is the
 * write-back path to the relay, and an inbound value must never bounce out
 * again. Without the guard, two devices echo the same object at each other.
 */
export function hydrateSettings(settings: StoredSettings): StoredState {
  const current = loadState();
  return saveState({
    ...current,
    settings: { ...current.settings, ...settings },
    version: 3,
    updatedAt: Date.now(),
  });
}

export function patchSettings(patch: StoredSettings): StoredState {
  const current = loadState();
  const settings: StoredSettings = { ...current.settings, ...patch, updatedAt: Date.now() };
  const next = saveState({
    ...current,
    settings,
    version: 3,
    updatedAt: Date.now(),
  });
  try {
    if (typeof window !== 'undefined') {
      // The whole merged object, stamped: the ring writer needs neither a read
      // nor its own clock, so two fields changed at once cannot clobber.
      const event = new CustomEvent(STORAGE_EVENT, { detail: settings });
      window.dispatchEvent(event);
    }
  } catch {
    // ignore
  }
  return next;
}

export function getPosition(reciterId: number | undefined): StoredPosition | undefined {
  if (!reciterId) return undefined;
  return loadState().positions[String(reciterId)];
}

let pendingWrite: { state: StoredState; timer: number } | null = null;

function flushPendingWrite(): void {
  if (!pendingWrite) return;
  window.clearTimeout(pendingWrite.timer);
  saveState(pendingWrite.state);
  pendingWrite = null;
}

/**
 * Coalesces the playhead: a five-second interval plus seeks would otherwise hit
 * localStorage dozens of times a minute. The latest write always wins, and
 * `flushPosition` forces it (pause, surah swap, pagehide).
 */
export function setPosition(reciterId: number | undefined, surahId: number, position: number): void {
  if (!reciterId || typeof window === 'undefined') return;
  const current = loadState();
  const next: StoredState = {
    ...current,
    reciterId,
    lastSurahId: surahId,
    positions: {
      ...current.positions,
      [String(reciterId)]: { surahId, position: Math.max(0, position), updatedAt: Date.now() },
    },
  };

  if (pendingWrite) window.clearTimeout(pendingWrite.timer);
  pendingWrite = {
    state: next,
    timer: window.setTimeout(() => {
      if (pendingWrite) saveState(pendingWrite.state);
      pendingWrite = null;
    }, POSITION_WRITE_DELAY),
  };
}

/** Write the pending playhead now. Safe to call when nothing is pending. */
export function flushPosition(): void {
  flushPendingWrite();
}

export function setLastSurah(surahId: number): void {
  const current = loadState();
  if (current.lastSurahId === surahId) return;
  saveState({ ...current, lastSurahId: surahId, updatedAt: Date.now() });
}
