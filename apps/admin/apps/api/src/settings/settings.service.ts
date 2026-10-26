import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';

/**
 * Trackers a generated magnet announces to.
 *
 * They are configuration, not code: a new tracker domain is an edit here, and
 * every magnet the dashboard builds (reciter save, catalogue import, the torrent
 * tool) appends the same set. Web players can only use `ws://`/`wss://`; the
 * validator is strict so a `udp://` line cannot silently produce a magnet the
 * browser ignores.
 */
export const DEFAULT_TRACKERS = ['wss://tracker.quran.us.kg'] as const;

@Injectable()
export class SettingsService {
  constructor(@Inject(SQLITE_DB) private readonly db: Db) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
  }

  getTrackers(): string[] {
    const row = this.db.prepare("SELECT value FROM app_settings WHERE key = 'trackers'").get() as
      { value: string } | undefined;
    if (!row) return [...DEFAULT_TRACKERS];
    try {
      const parsed = JSON.parse(row.value) as unknown;
      return Array.isArray(parsed) ? (parsed as string[]) : [...DEFAULT_TRACKERS];
    } catch {
      return [...DEFAULT_TRACKERS];
    }
  }

  /** Replaces the list; an empty list is allowed (magnet announces via DHT only). */
  setTrackers(trackers: string[]): string[] {
    const cleaned = [...new Set(trackers.map((entry) => entry.trim()).filter(Boolean))];
    for (const tracker of cleaned) {
      if (!/^wss?:\/\/.+/i.test(tracker)) {
        throw new BadRequestException(
          `not a WebSocket tracker URL: ${tracker} (expected wss:// or ws://)`,
        );
      }
    }
    this.db
      .prepare(
        "INSERT INTO app_settings (key, value) VALUES ('trackers', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(JSON.stringify(cleaned));
    return cleaned;
  }

  /**
   * Adds the configured trackers to a magnet, keeping whatever it already had.
   * Trackers are outside the info hash, so this never changes a torrent's identity.
   */
  withTrackers(magnet: string): string {
    return mergeTrackers(magnet, this.getTrackers());
  }
}

/** Pure merge, exported for tests: existing `tr=` entries are kept and deduped. */
export function mergeTrackers(magnet: string, trackers: string[]): string {
  if (!magnet.startsWith('magnet:')) return magnet;
  const url = new URL(magnet);
  const existing = url.searchParams.getAll('tr');
  const merged = [...new Set([...existing, ...trackers])];
  const params = new URLSearchParams();
  const xt = url.searchParams.get('xt');
  if (xt) params.set('xt', xt);
  const dn = url.searchParams.get('dn');
  if (dn) params.set('dn', dn);
  for (const tracker of merged) params.append('tr', tracker);
  // Anything else the magnet carried (xl, ws, so, as) is preserved as-is.
  for (const [key, value] of url.searchParams) {
    if (!['xt', 'dn', 'tr'].includes(key)) params.append(key, value);
  }
  return `magnet:?${params.toString()}`;
}

/** A fresh magnet for a catalogue row: hash + name + the configured trackers. */
export function magnetForInfo(infoHash: string, name: string, trackers: string[]): string {
  const params = new URLSearchParams({ xt: `urn:btih:${infoHash}`, dn: name });
  for (const tracker of trackers) params.append('tr', tracker);
  return `magnet:?${params.toString()}`;
}
