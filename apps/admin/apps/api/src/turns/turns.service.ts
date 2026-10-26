import { Injectable, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';
import { stunProbe } from './stun.probe';

/** Probe timeout: generous enough for a transatlantic turn, short enough for a cron. */
const PROBE_TIMEOUT_MS = 5000;
/** History retention: 288 checks at 5-minute spacing is the last 24 hours. */
const HISTORY_KEEP = 288;

export interface TurnServer {
  id: number;
  name: string;
  url: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  /** Last successful round trip, milliseconds. Null until the first probe lands. */
  latencyMs: number | null;
  activeAllocations: number;
}

export interface TurnCheck {
  checkedAt: string;
  ok: boolean;
  latencyMs: number | null;
  detail: string | null;
}

/**
 * Parses a TURN URL ("turn:host:port?transport=udp", "turns:host:port",
 * bare "host:port") into the UDP endpoint the STUN probe dials.
 */
export function parseTurnEndpoint(url: string): { host: string; port: number } {
  const bare = url
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^[a-z]+:/, '')
    .split('?')[0];
  const lastColon = bare.lastIndexOf(':');
  if (lastColon === -1) return { host: bare, port: 3478 };
  const host = bare.slice(0, lastColon);
  const port = Number.parseInt(bare.slice(lastColon + 1), 10);
  if (!host || Number.isNaN(port)) throw new Error(`cannot parse TURN URL: ${url}`);
  return { host, port: port || 3478 };
}

@Injectable()
export class TurnsService implements OnModuleInit {
  constructor(@Inject(SQLITE_DB) private readonly db: Db) {
    this.ensureSchema();
  }

  /**
   * Schema is owned here rather than by a migration file (the fork's spec-table
   * pattern): a migration cannot conditionally ALTER, and the production
   * database already carries this table from the pre-history service code.
   */
  private ensureSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS turn_servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'unknown',
        last_seen TEXT,
        latency_ms INTEGER,
        active_allocations INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS turn_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        turn_id INTEGER NOT NULL REFERENCES turn_servers(id) ON DELETE CASCADE,
        checked_at TEXT NOT NULL DEFAULT (datetime('now')),
        ok INTEGER NOT NULL,
        latency_ms INTEGER,
        detail TEXT
      );
      CREATE INDEX IF NOT EXISTS turn_checks_turn_idx ON turn_checks (turn_id, id DESC);
    `);
    // Older rows (pre-history installs) lack the latency column; add it in place.
    const cols = (this.db.pragma('table_info(turn_servers)') as { name: string }[]).map(
      (c) => c.name,
    );
    if (!cols.includes('latency_ms')) {
      this.db.exec('ALTER TABLE turn_servers ADD COLUMN latency_ms INTEGER');
    }
  }

  onModuleInit(): void {
    // Immediately reflect stored status tables.
    void this.runChecks();
  }

  list(): TurnServer[] {
    return (
      this.db.prepare('SELECT * FROM turn_servers ORDER BY id').all() as Record<string, unknown>[]
    ).map(mapRow);
  }

  get(id: number): TurnServer | null {
    const r = this.db.prepare('SELECT * FROM turn_servers WHERE id = ?').get(id) as
      Record<string, unknown> | undefined;
    return r ? mapRow(r) : null;
  }

  add(name: string, url: string): TurnServer {
    parseTurnEndpoint(url); // refuse to store an unprobeable URL
    const info = this.db
      .prepare('INSERT INTO turn_servers (name, url) VALUES (?, ?)')
      .run(name, url);
    return this.get(Number(info.lastInsertRowid))!;
  }

  /**
   * Edit a server's label or endpoint. The URL is re-validated with the same
   * parser the probe uses, so an address that cannot be dialled is refused here
   * rather than becoming a node that is permanently offline.
   */
  update(id: number, input: { name?: string; url?: string }): TurnServer | null {
    const existing = this.get(id);
    if (!existing) return null;
    const sets: string[] = [];
    const values: unknown[] = [];
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error('the name cannot be empty');
      sets.push('name = ?');
      values.push(name);
    }
    if (input.url !== undefined) {
      const url = input.url.trim();
      parseTurnEndpoint(url); // throws when the host/port cannot be parsed
      sets.push('url = ?');
      values.push(url);
    }
    if (sets.length > 0) {
      this.db.prepare(`UPDATE turn_servers SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
    }
    return this.get(id);
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM turn_checks WHERE turn_id = ?').run(id);
    this.db.prepare('DELETE FROM turn_servers WHERE id = ?').run(id);
  }

  /** Recent probe history for one server, newest first. */
  history(id: number, limit = 50): TurnCheck[] {
    return (
      this.db
        .prepare(
          'SELECT checked_at, ok, latency_ms, detail FROM turn_checks WHERE turn_id = ? ORDER BY id DESC LIMIT ?',
        )
        .all(id, limit) as {
        checked_at: string;
        ok: number;
        latency_ms: number | null;
        detail: string | null;
      }[]
    ).map((r) => ({
      checkedAt: r.checked_at,
      ok: r.ok === 1,
      latencyMs: r.latency_ms,
      detail: r.detail,
    }));
  }

  /** Probe one server (or all) and record the outcome. */
  async runChecks(id?: number): Promise<TurnServer[]> {
    const rows = (
      id === undefined
        ? this.db.prepare('SELECT id, url FROM turn_servers ORDER BY id').all()
        : this.db.prepare('SELECT id, url FROM turn_servers WHERE id = ?').all(id)
    ) as { id: number; url: string }[];

    await Promise.all(
      rows.map(async (row) => {
        let result;
        try {
          const { host, port } = parseTurnEndpoint(row.url);
          result = await stunProbe({ host, port, timeoutMs: PROBE_TIMEOUT_MS, url: row.url });
        } catch (err) {
          result = {
            ok: false,
            latencyMs: PROBE_TIMEOUT_MS,
            errorText: (err as Error).message,
            mappedAddress: null,
          };
        }
        this.record(row.id, result.ok, result.latencyMs, result.errorText ?? null);
      }),
    );
    return id === undefined ? this.list() : this.list().filter((t) => t.id === id);
  }

  private record(turnId: number, ok: boolean, latencyMs: number, detail: string | null): void {
    this.db
      .prepare(
        "UPDATE turn_servers SET status = ?, last_seen = datetime('now'), latency_ms = ? WHERE id = ?",
      )
      .run(ok ? 'online' : 'offline', ok ? latencyMs : null, turnId);
    this.db
      .prepare('INSERT INTO turn_checks (turn_id, ok, latency_ms, detail) VALUES (?, ?, ?, ?)')
      .run(turnId, ok ? 1 : 0, ok ? latencyMs : null, detail);
    // Retention: keep the last HISTORY_KEEP checks per server.
    this.db
      .prepare(
        `DELETE FROM turn_checks WHERE turn_id = ? AND id NOT IN (
           SELECT id FROM turn_checks WHERE turn_id = ? ORDER BY id DESC LIMIT ?
         )`,
      )
      .run(turnId, turnId, HISTORY_KEEP);
  }

  /** Kept for the controller contract: probe a single server, return its new row. */
  async poll(id: number): Promise<TurnServer | null> {
    if (!this.get(id)) return null;
    const [updated] = await this.runChecks(id);
    return updated ?? null;
  }

  async pollAll(): Promise<TurnServer[]> {
    return this.runChecks();
  }
}

function mapRow(r: Record<string, unknown>): TurnServer {
  return {
    id: r.id as number,
    name: r.name as string,
    url: r.url as string,
    status: r.status as TurnServer['status'],
    lastSeen: (r.last_seen as string | null) ?? null,
    latencyMs: (r.latency_ms as number | null) ?? null,
    activeAllocations: r.active_allocations as number,
  };
}
