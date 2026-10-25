import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';
import * as net from 'net';

export interface TurnServer {
  id: number;
  name: string;
  url: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  activeAllocations: number;
}

@Injectable()
export class TurnsService {
  constructor(@Inject(SQLITE_DB) private readonly db: Db) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS turn_servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'unknown',
        last_seen TEXT,
        active_allocations INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  list(): TurnServer[] {
    return this.db.prepare('SELECT * FROM turn_servers ORDER BY id').all().map((r: any) => ({
      id: r.id, name: r.name, url: r.url, status: r.status,
      lastSeen: r.last_seen, activeAllocations: r.active_allocations,
    }));
  }

  add(name: string, url: string): TurnServer {
    const info = this.db.prepare('INSERT INTO turn_servers (name, url) VALUES (?, ?)').run(name, url);
    return this.get(Number(info.lastInsertRowid))!;
  }

  get(id: number): TurnServer | null {
    const r = this.db.prepare('SELECT * FROM turn_servers WHERE id = ?').get(id) as any;
    if (!r) return null;
    return { id: r.id, name: r.name, url: r.url, status: r.status, lastSeen: r.last_seen, activeAllocations: r.active_allocations };
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM turn_servers WHERE id = ?').run(id);
  }

  async poll(id: number): Promise<TurnServer | null> {
    const turn = this.get(id);
    if (!turn) return null;
    // Parse host:port from url (e.g., "turn:example.com:3478" or "example.com:3478")
    const hostPort = turn.url.replace(/^turn:/, '').replace(/^turns:/, '');
    const [host, portStr] = hostPort.split(':');
    const port = parseInt(portStr || '3478', 10);
    try {
      await new Promise<void>((resolve, reject) => {
        const sock = new net.Socket();
        sock.setTimeout(5000);
        sock.on('connect', () => { sock.destroy(); resolve(); });
        sock.on('timeout', () => { sock.destroy(); reject(new Error('timeout')); });
        sock.on('error', (e) => { sock.destroy(); reject(e); });
        sock.connect(port, host);
      });
      this.db.prepare("UPDATE turn_servers SET status='online', last_seen=datetime('now') WHERE id=?").run(id);
    } catch {
      this.db.prepare("UPDATE turn_servers SET status='offline', last_seen=datetime('now') WHERE id=?").run(id);
    }
    return this.get(id);
  }

  async pollAll(): Promise<TurnServer[]> {
    const turns = this.list();
    await Promise.all(turns.map(t => this.poll(t.id)));
    return this.list();
  }
}