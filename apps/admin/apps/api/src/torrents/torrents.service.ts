import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';

export interface Torrent {
  id: number;
  name: string;
  infohash: string;
  magnet: string;
  createdAt: string;
}

@Injectable()
export class TorrentsService {
  constructor(@Inject(SQLITE_DB) private readonly db: Db) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS torrents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        infohash TEXT NOT NULL,
        magnet TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  list(): Torrent[] {
    return this.db.prepare('SELECT * FROM torrents ORDER BY id DESC').all().map((r: any) => ({
      id: r.id, name: r.name, infohash: r.infohash, magnet: r.magnet, createdAt: r.created_at,
    }));
  }

  add(name: string, infohash: string, magnet: string): Torrent {
    const info = this.db.prepare('INSERT INTO torrents (name, infohash, magnet) VALUES (?, ?, ?)').run(name, infohash, magnet);
    return this.get(Number(info.lastInsertRowid))!;
  }

  get(id: number): Torrent | null {
    const r = this.db.prepare('SELECT * FROM torrents WHERE id = ?').get(id) as any;
    if (!r) return null;
    return { id: r.id, name: r.name, infohash: r.infohash, magnet: r.magnet, createdAt: r.created_at };
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM torrents WHERE id = ?').run(id);
  }
}
