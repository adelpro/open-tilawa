import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';

export interface Seeder {
  id: number;
  name: string;
  url: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  torrentCount: number;
  peerCount: number;
  uploadSpeed: number;
  downloadSpeed: number;
}

@Injectable()
export class SeedersService {
  constructor(@Inject(SQLITE_DB) private readonly db: Db) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS seeders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'unknown',
        last_seen TEXT,
        torrent_count INTEGER NOT NULL DEFAULT 0,
        peer_count INTEGER NOT NULL DEFAULT 0,
        upload_speed INTEGER NOT NULL DEFAULT 0,
        download_speed INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  list(): Seeder[] {
    return this.db.prepare('SELECT * FROM seeders ORDER BY id').all().map((r: any) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      status: r.status,
      lastSeen: r.last_seen,
      torrentCount: r.torrent_count,
      peerCount: r.peer_count,
      uploadSpeed: r.upload_speed,
      downloadSpeed: r.download_speed,
    }));
  }

  add(name: string, url: string): Seeder {
    const info = this.db.prepare('INSERT INTO seeders (name, url) VALUES (?, ?)').run(name, url);
    return this.get(Number(info.lastInsertRowid))!;
  }

  get(id: number): Seeder | null {
    const r = this.db.prepare('SELECT * FROM seeders WHERE id = ?').get(id) as any;
    if (!r) return null;
    return {
      id: r.id, name: r.name, url: r.url, status: r.status,
      lastSeen: r.last_seen, torrentCount: r.torrent_count,
      peerCount: r.peer_count, uploadSpeed: r.upload_speed,
      downloadSpeed: r.download_speed,
    };
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM seeders WHERE id = ?').run(id);
  }

  async poll(id: number): Promise<Seeder | null> {
    const seeder = this.get(id);
    if (!seeder) return null;
    try {
      const res = await fetch(`${seeder.url}/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('bad status');
      const data = await res.json() as any;
      this.db.prepare(`
        UPDATE seeders SET status='online', last_seen=datetime('now'),
        torrent_count=?, peer_count=?, upload_speed=?, download_speed=? WHERE id=?
      `).run(
        data.torrents ?? data.stats?.totalTorrents ?? 0,
        data.peers ?? data.stats?.totalPeers ?? 0,
        data.uploadSpeed ?? data.stats?.uploadSpeed ?? 0,
        data.downloadSpeed ?? data.stats?.downloadSpeed ?? 0,
        id,
      );
    } catch {
      this.db.prepare("UPDATE seeders SET status='offline', last_seen=datetime('now') WHERE id=?").run(id);
    }
    return this.get(id);
  }

  async pollAll(): Promise<Seeder[]> {
    const seeders = this.list();
    await Promise.all(seeders.map(s => this.poll(s.id)));
    return this.list();
  }
}