/**
 * Local persistence, v2.
 *
 * The v1 shape was flat (`{ reciterId, surahIndex, position }`) and every write
 * clobbered the previous reciter's position. v2 keeps a small map instead, so
 * "continue listening" works across reciters, and it migrates the v1 keys
 * rather than orphaning them.
 */

export const STORAGE_KEY = 'open-tilawa:v2';
const LEGACY_KEY = 'tilawa:state';
const LEGACY_PROGRESS_PREFIX = 'tilawa:progress:';
const MAX_POSITIONS = 10;

export type StoredPosition = {
  /** 1–114. Note: v1 stored a 0-based playlist index; the migration shifts it. */
  surahId: number;
  position: number;
  updatedAt: number;
};

export type Theme = 'light' | 'dark';

export type StoredState = {
  version: 2;
  reciterId?: number;
  positions: Record<string, StoredPosition>;
  /** Optional so a blob written by the chrome-less build stays valid. */
  theme?: Theme;
  rate?: number;
  updatedAt: number;
};

export const DEFAULT_STATE: StoredState = {
  version: 2,
  positions: {},
  updatedAt: 0,
};

type LegacyState = {
  reciterId?: number;
  surahIndex?: number;
  position?: number;
  updatedAt?: number;
};

function toPosition(surahIndex: number, position: number, updatedAt: number): StoredPosition {
  return { surahId: surahIndex + 1, position: Math.max(0, position || 0), updatedAt };
}

/**
 * Pure migration so it can be tested: given whatever the browser holds, return
 * a valid v2 state. Unknown shapes degrade to defaults — never throw.
 */
export function migrateLegacy(
  legacy: LegacyState | null,
  progress: Record<string, { surahIndex?: number; position?: number; updatedAt?: number }>,
): StoredState {
  const positions: Record<string, StoredPosition> = {};

  for (const [reciterId, entry] of Object.entries(progress)) {
    if (typeof entry?.surahIndex !== 'number') continue;
    positions[reciterId] = toPosition(
      entry.surahIndex,
      entry.position ?? 0,
      entry.updatedAt ?? 0,
    );
  }

  const reciterId = legacy?.reciterId;
  if (typeof reciterId === 'number' && typeof legacy?.surahIndex === 'number') {
    positions[String(reciterId)] = toPosition(
      legacy.surahIndex,
      legacy.position ?? 0,
      legacy.updatedAt ?? 0,
    );
  }

  return {
    ...DEFAULT_STATE,
    reciterId: typeof reciterId === 'number' ? reciterId : undefined,
    positions,
    updatedAt: Math.max(legacy?.updatedAt ?? 0, 0),
  };
}

export function isStoredState(value: unknown): value is StoredState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredState>;
  return candidate.version === 2 && typeof candidate.positions === 'object';
}

export function loadState(): StoredState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStoredState(parsed)) {
        // Pick the known fields only, so a build that stored repeat/shuffle
        // cannot keep resurrecting them.
        const theme = (parsed as { theme?: unknown }).theme;
        const rate = (parsed as { rate?: unknown }).rate;
        return {
          version: 2,
          reciterId: typeof parsed.reciterId === 'number' ? parsed.reciterId : undefined,
          positions: parsed.positions ?? {},
          theme: theme === 'light' || theme === 'dark' ? theme : undefined,
          rate: typeof rate === 'number' && Number.isFinite(rate) ? rate : undefined,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
        };
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_KEY);
    const legacy: LegacyState | null = legacyRaw ? JSON.parse(legacyRaw) : null;

    const progress: Record<string, { surahIndex?: number; position?: number; updatedAt?: number }> = {};
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
  return saveState({ ...current, ...patch, version: 2, updatedAt: Date.now() });
}

export function getPosition(reciterId: number | undefined): StoredPosition | undefined {
  if (!reciterId) return undefined;
  return loadState().positions[String(reciterId)];
}

export function setPosition(
  reciterId: number | undefined,
  surahId: number,
  position: number,
): void {
  if (!reciterId) return;
  const current = loadState();
  const positions = {
    ...current.positions,
    [String(reciterId)]: { surahId, position: Math.max(0, position), updatedAt: Date.now() },
  };
  saveState({ ...current, positions, reciterId });
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
