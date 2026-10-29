import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';
import { ALERT_KINDS, isAlertKind, type AlertKind } from '../notifications/alert-kinds';
import { decryptSecret, encryptSecret, readMailKey } from './mail-secret';

/** How the SMTP connection is protected. `ssl` is implicit TLS on 465. */
export type MailTls = 'ssl' | 'starttls' | 'none';

export interface MailConfig {
  host: string | null;
  port: number;
  tls: MailTls;
  user: string | null;
  from: string | null;
  /** Decrypted, in-process only. Null when absent or undecryptable. */
  password: string | null;
  /** A ciphertext exists, whether or not this process can read it. */
  hasPassword: boolean;
  verifiedAt: string | null;
}

export interface MailConfigInput {
  host: string;
  port: number;
  tls: MailTls;
  user?: string;
  from?: string;
  /** `undefined` keeps the stored secret, `null` clears it, a string replaces it. */
  password?: string | null;
  verifiedAt?: string | null;
}

export interface NotifySettings {
  enabled: AlertKind[];
  serviceFailures: number;
  diskFloorBytes: number;
  extraRecipients: string[];
}

export const DEFAULT_NOTIFY: NotifySettings = {
  enabled: [...ALERT_KINDS],
  serviceFailures: 3,
  // 20 GiB: below this a node is a few placements from refusing content.
  diskFloorBytes: 21_474_836_480,
  extraRecipients: [],
};

const MAIL_TLS: readonly MailTls[] = ['ssl', 'starttls', 'none'];

/** `ops@x.tld` or `Name <ops@x.tld>`; anything else is a typo, not a policy. */
function looksLikeAddress(value: string): boolean {
  const inner = value.match(/<([^>]+)>/)?.[1] ?? value;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inner.trim());
}

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
  private readonly logger = new Logger(SettingsService.name);

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

  // --- outbound mail -------------------------------------------------------

  /**
   * The stored transport.
   *
   * A password this process cannot decrypt is reported as `null` with
   * `hasPassword` still true, rather than thrown: a rotated `MAIL_SECRET` must
   * not take the console down, and the transport falls back to the environment.
   */
  getMailConfig(): MailConfig {
    const ciphertext = this.read('mail.pass');
    let password: string | null = null;
    if (ciphertext) {
      const key = readMailKey(process.env);
      if (key) {
        try {
          password = decryptSecret(ciphertext, key);
        } catch (error) {
          this.logger.error(`cannot decrypt the stored mail password: ${(error as Error).message}`);
        }
      }
    }
    const tls = this.read('mail.tls');
    const port = Number(this.read('mail.port') ?? 465);
    return {
      host: this.read('mail.host'),
      port: Number.isFinite(port) ? port : 465,
      tls: MAIL_TLS.includes(tls as MailTls) ? (tls as MailTls) : 'ssl',
      user: this.read('mail.user'),
      from: this.read('mail.from'),
      password,
      hasPassword: ciphertext !== null,
      verifiedAt: this.read('mail.verifiedAt'),
    };
  }

  setMailConfig(input: MailConfigInput): MailConfig {
    const host = input.host?.trim();
    if (!host) throw new BadRequestException('an SMTP host is required');
    if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
      throw new BadRequestException(`not a port: ${input.port}`);
    }
    if (!MAIL_TLS.includes(input.tls)) {
      throw new BadRequestException(`not a TLS mode: ${input.tls} (expected ${MAIL_TLS.join(', ')})`);
    }
    const from = input.from?.trim() ?? '';
    if (from && !looksLikeAddress(from)) {
      throw new BadRequestException(`not an address: ${from}`);
    }

    // An untouched form field arrives as ''. Clearing is an explicit `null`.
    let password = input.password;
    if (password === '') password = undefined;

    if (typeof password === 'string') {
      const key = readMailKey(process.env);
      if (!key) {
        throw new BadRequestException(
          'MAIL_SECRET is not set — add it to apps/admin/.env to store a password',
        );
      }
      this.write('mail.pass', encryptSecret(password, key));
    } else if (password === null) {
      this.removeKey('mail.pass');
    }

    this.write('mail.host', host);
    this.write('mail.port', String(input.port));
    this.write('mail.tls', input.tls);
    this.write('mail.user', input.user?.trim() ?? '');
    this.write('mail.from', from);
    if (input.verifiedAt !== undefined) {
      if (input.verifiedAt === null) this.removeKey('mail.verifiedAt');
      else this.write('mail.verifiedAt', input.verifiedAt);
    }
    return this.getMailConfig();
  }

  /** Back to the environment, which stays the bootstrap path. */
  clearMailConfig(): void {
    this.removePrefix('mail.');
  }

  // --- operator notifications ---------------------------------------------

  getNotifySettings(): NotifySettings {
    // An absent row means "never configured"; an empty array means the operator
    // switched every alert off, which is a legitimate choice.
    const enabledRow = this.read('notify.enabled');
    return {
      enabled:
        enabledRow === null ? [...DEFAULT_NOTIFY.enabled] : this.readList('notify.enabled').filter(isAlertKind),
      serviceFailures: this.readNumber('notify.serviceFailures', DEFAULT_NOTIFY.serviceFailures),
      diskFloorBytes: this.readNumber('notify.diskFloorBytes', DEFAULT_NOTIFY.diskFloorBytes),
      extraRecipients: this.readList('notify.extraRecipients'),
    };
  }

  setNotifySettings(input: Partial<NotifySettings>): NotifySettings {
    if (input.enabled !== undefined) {
      const unknown = input.enabled.filter((kind) => !isAlertKind(kind));
      if (unknown.length > 0) throw new BadRequestException(`not an alert kind: ${unknown.join(', ')}`);
      this.write('notify.enabled', JSON.stringify([...new Set(input.enabled)]));
    }
    if (input.serviceFailures !== undefined) {
      if (!Number.isFinite(input.serviceFailures)) throw new BadRequestException('serviceFailures must be a number');
      this.write('notify.serviceFailures', String(Math.min(20, Math.max(1, Math.round(input.serviceFailures)))));
    }
    if (input.diskFloorBytes !== undefined) {
      if (!Number.isFinite(input.diskFloorBytes) || input.diskFloorBytes < 0) {
        throw new BadRequestException('diskFloorBytes must be zero or more');
      }
      this.write('notify.diskFloorBytes', String(Math.round(input.diskFloorBytes)));
    }
    if (input.extraRecipients !== undefined) {
      const cleaned = [...new Set(input.extraRecipients.map((entry) => entry.trim()).filter(Boolean))];
      const invalid = cleaned.filter((entry) => !looksLikeAddress(entry));
      if (invalid.length > 0) throw new BadRequestException(`not an address: ${invalid.join(', ')}`);
      this.write('notify.extraRecipients', JSON.stringify(cleaned));
    }
    return this.getNotifySettings();
  }

  // --- settings primitives -------------------------------------------------

  private read(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  private write(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value);
  }

  /** Exactly one key. */
  private removeKey(key: string): void {
    this.db.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
  }

  /** Every key under a prefix, e.g. `mail.`. */
  private removePrefix(prefix: string): void {
    this.db.prepare('DELETE FROM app_settings WHERE key LIKE ?').run(`${prefix}%`);
  }

  private readNumber(key: string, fallback: number): number {
    const raw = this.read(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readList(key: string): string[] {
    const raw = this.read(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
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
