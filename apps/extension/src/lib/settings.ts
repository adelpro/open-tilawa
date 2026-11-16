/**
 * The volunteer's choices, and the defaults they inherit.
 *
 * Two rules shaped this file. First, the cap is a **count of reciters**, because
 * "two reciters" is a decision someone can make and "6 GB" is not. Second, an
 * upload cap of zero means "do not upload" and must survive parsing — the
 * browser's own throttle treats 0 as a real rate, and turning it into the default
 * would silently un-pause someone who asked for silence.
 *
 * Everything here is parsed, never trusted: this storage is editable by hand, is
 * written by an older version of the code after an update, and a NaN reaching
 * `throttleUpload` would throw inside the engine.
 */

import { browser } from 'wxt/browser';

import { parseHeld, type HeldReciter } from '@/lib/catalogue';

export type ListeningMode = 'manual' | 'follow' | 'mixed';

export type Settings = {
  maxReciters: number;
  uploadMbps: number;
  pauseOnBattery: boolean;
  pauseOnMetered: boolean;
  schedule: { from: number; to: number } | null;
  paused: boolean;
  mode: ListeningMode;
  followCap: number;
  /** Decimal GB the whole held roster may occupy; 0 means no limit. */
  maxDiskGb: number;
};

export const DEFAULTS: Settings = {
  maxReciters: 3,
  uploadMbps: 1,
  pauseOnBattery: true,
  pauseOnMetered: true,
  schedule: null,
  paused: false,
  // Mixed is the product's shape: what you listen to is what this device helps
  // serve, under a cap you keep. Manual is one radio card away.
  mode: 'mixed',
  followCap: 2,
  maxDiskGb: 10,
};

/** One decimal gigabyte; the number the settings screen speaks in. */
export const BYTES_PER_GB = 1_000_000_000;

export const SETTINGS_KEY = 'tilawah-companion.settings.v1';
export const HELD_KEY = 'tilawah-companion.held.v1';

const MIN_RECITERS = 1;
const MAX_RECITERS = 12;
const MAX_MBPS = 1000;
/** 0 disables following entirely; 6 mirrors the manual cap's UI ceiling. */
const MAX_FOLLOW_CAP = 6;
/** Ceiling for the disk budget in GB; 0 keeps its "no limit" meaning. */
const MAX_DISK_GB = 500;

const MODES: readonly ListeningMode[] = ['manual', 'follow', 'mixed'];

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/**
 * `0` is a real choice; anything unreadable is the default. Never `Infinity`.
 */
export function parseUploadMbps(value: unknown): number {
  if (value === 0) return 0;
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0) return DEFAULTS.uploadMbps;
  return clamp(numeric, 0, MAX_MBPS);
}

function parseSchedule(value: unknown): Settings['schedule'] {
  if (!value || typeof value !== 'object') return null;
  const { from, to } = value as { from?: unknown; to?: unknown };
  const isHour = (hour: unknown): hour is number => Number.isInteger(hour) && (hour as number) >= 0 && (hour as number) <= 23;
  if (!isHour(from) || !isHour(to)) return null;
  return { from, to };
}

export function parseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const input = raw as Partial<Record<keyof Settings, unknown>>;

  const maxReciters =
    Number.isInteger(input.maxReciters) && typeof input.maxReciters === 'number'
      ? clamp(input.maxReciters, MIN_RECITERS, MAX_RECITERS)
      : DEFAULTS.maxReciters;

  return {
    maxReciters,
    uploadMbps: input.uploadMbps === undefined ? DEFAULTS.uploadMbps : parseUploadMbps(input.uploadMbps),
    pauseOnBattery:
      typeof input.pauseOnBattery === 'boolean' ? input.pauseOnBattery : DEFAULTS.pauseOnBattery,
    pauseOnMetered:
      typeof input.pauseOnMetered === 'boolean' ? input.pauseOnMetered : DEFAULTS.pauseOnMetered,
    schedule: input.schedule === undefined ? DEFAULTS.schedule : parseSchedule(input.schedule),
    paused: typeof input.paused === 'boolean' ? input.paused : DEFAULTS.paused,
    mode: MODES.includes(input.mode as ListeningMode) ? (input.mode as ListeningMode) : DEFAULTS.mode,
    followCap:
      typeof input.followCap === 'number' &&
      Number.isInteger(input.followCap) &&
      input.followCap >= 0 &&
      input.followCap <= MAX_FOLLOW_CAP
        ? input.followCap
        : DEFAULTS.followCap,
    // Garbage here must never become "unlimited": the person asked for a
    // ceiling, and losing it silently fills their disk while the screen says
    // otherwise.
    maxDiskGb:
      typeof input.maxDiskGb === 'number' &&
      Number.isInteger(input.maxDiskGb) &&
      input.maxDiskGb >= 0 &&
      input.maxDiskGb <= MAX_DISK_GB
        ? input.maxDiskGb
        : DEFAULTS.maxDiskGb,
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  return parseSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function loadHeld<T>(): Promise<T[]> {
  const stored = await browser.storage.local.get(HELD_KEY);
  const list = stored[HELD_KEY];
  return Array.isArray(list) ? (list as T[]) : [];
}

/**
 * The held roster, parsed — not cast. `loadHeld` predates the source tag; this
 * is the one new code should use, because the follow list's recency lives in
 * the order and a `source` tag must survive every read.
 */
export async function loadHeldReciters(): Promise<HeldReciter[]> {
  const stored = await browser.storage.local.get(HELD_KEY);
  return parseHeld(stored[HELD_KEY]);
}

export async function saveHeld<T>(list: T[]): Promise<void> {
  await browser.storage.local.set({ [HELD_KEY]: list });
}
