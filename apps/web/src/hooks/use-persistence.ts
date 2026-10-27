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

export const STORAGE_KEY = 'open-tilawa:v3';
const PREVIOUS_KEY = 'open-tilawa:v2';
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
          settings: settingsOf(parsed.settings ?? {}),
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

export function patchSettings(patch: StoredSettings): StoredState {
  const current = loadState();
  return saveState({
    ...current,
    settings: { ...current.settings, ...patch },
    version: 3,
    updatedAt: Date.now(),
  });
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

export function clearState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(PREVIOUS_KEY);
  } catch {
    // ignore
  }
}
