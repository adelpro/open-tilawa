import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';

/**
 * Trackers a generated magnet announces to.
 *
 * They are configuration, not code: a new tracker domain is an edit here, and
 * every magnet the console builds (reciter save, catalogue import, the torrent
 * tool) appends the same set. Web players can only use `ws://`/`wss://`; the
 * validator is strict so a `udp://` line cannot silently produce a magnet the
 * browser ignores.
 */
export const DEFAULT_TRACKERS = ['wss://tracker.tilawah.cc'] as const;

/** Where `.torrent` files and /media are served; the magnet's `xs` points here. */
export const DEFAULT_WEB_ORIGIN = 'https://tilawah.cc';

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

  /**
   * Where the public site publishes `.torrent` files. Not the admin's own
   * WEBSITE: the player fetches them from the web origin, next to /media.
   */
  getWebOrigin(): string {
    const row = this.db
      .prepare("SELECT value FROM app_settings WHERE key = 'webOrigin'")
      .get() as { value: string } | undefined;
    return (row?.value ?? DEFAULT_WEB_ORIGIN).replace(/\/+$/, '');
  }

  setWebOrigin(origin: string): string {
    const clean = origin.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/.+/i.test(clean)) {
      throw new BadRequestException(`not an origin: ${origin}`);
    }
    this.db
      .prepare(
        "INSERT INTO app_settings (key, value) VALUES ('webOrigin', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(clean);
    return clean;
  }

  torrentUrl(infoHash: string): string {
    return `${this.getWebOrigin()}/torrents/${infoHash}.torrent`;
  }

  /** The single magnet builder: trackers + the exact-source URL, always. */
  magnetFor(infoHash: string, name: string): string {
    return magnetForInfo(infoHash, name, this.getTrackers(), this.torrentUrl(infoHash));
  }
}

/** Pure merge, exported for tests: existing `tr=` entries are kept and deduped. */
export function mergeTrackers(magnet: string, trackers: string[]): string {
  if (!magnet.startsWith('magnet:')) return magnet;
  const url = new URL(magnet);
  const existing = url.searchParams.getAll('tr');
  const merged = [...new Set([...existing, ...trackers])];
  // Anything else the magnet carried (xl, ws, so, as) is preserved as-is.
  const extras: [string, string][] = [];
  for (const [key, value] of url.searchParams) {
    if (!['xt', 'dn', 'tr'].includes(key)) extras.push([key, value]);
  }
  return magnetQuery({
    xt: url.searchParams.get('xt') ?? undefined,
    dn: url.searchParams.get('dn') ?? undefined,
    tr: merged,
    extras,
  });
}

/** A fresh magnet for a catalogue row: hash + name + the configured trackers. */
export function magnetForInfo(
  infoHash: string,
  name: string,
  trackers: string[],
  xs?: string | null,
): string {
  return magnetQuery({
    xt: `urn:btih:${infoHash}`,
    dn: name,
    tr: trackers,
    // `xs` is the exact-source URL: metadata arrives over HTTP even when no
    // swarm peer answers, which is what makes an HTTP-only reciter playable.
    extras: xs ? [['xs', xs]] : [],
  });
}

/**
 * A magnet query value, encoded exactly as much as it needs to be.
 *
 * `:` and `/` are legal inside a query value (RFC 3986), and every magnet parser
 * depends on seeing them literally: magnet-uri splits on `&`/`=` and does not
 * percent-decode, so `xt=urn%3Abtih%3A…` is rejected as an invalid torrent
 * identifier — which is precisely what `URLSearchParams.toString()` produces.
 * Values are therefore encoded here and those two characters restored.
 */
function magnetValue(value: string): string {
  return encodeURIComponent(value).replace(/%3A/gi, ':').replace(/%2F/gi, '/');
}

interface MagnetQuery {
  xt?: string;
  dn?: string;
  tr?: string[];
  /** Parameters this service does not own: ws, xl, so, as… */
  extras?: [string, string][];
}

function magnetQuery({ xt, dn, tr = [], extras = [] }: MagnetQuery): string {
  const parts: string[] = [];
  if (xt) parts.push(`xt=${magnetValue(xt)}`);
  if (dn) parts.push(`dn=${magnetValue(dn)}`);
  for (const tracker of tr) parts.push(`tr=${magnetValue(tracker)}`);
  for (const [key, value] of extras) parts.push(`${magnetValue(key)}=${magnetValue(value)}`);
  return `magnet:?${parts.join('&')}`;
}
