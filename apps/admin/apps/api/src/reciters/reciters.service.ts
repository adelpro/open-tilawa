import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';

export interface Reciter {
  id: number;
  name: string;
  riwaya: string;
  infohash: string;
  magnet: string;
  fileCount: number;
  createdAt: string;
}

@Injectable()
export class RecitersService {
  constructor(@Inject(SQLITE_DB) private readonly db: Db) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reciters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        riwaya TEXT NOT NULL DEFAULT 'Hafs',
        infohash TEXT NOT NULL,
        magnet TEXT NOT NULL,
        file_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  list(): Reciter[] {
    return this.db.prepare('SELECT * FROM reciters ORDER BY id').all().map((r: any) => ({
      id: r.id, name: r.name, riwaya: r.riwaya, infohash: r.infohash,
      magnet: r.magnet, fileCount: r.file_count, createdAt: r.created_at,
    }));
  }

  add(name: string, riwaya: string, infohash: string, magnet: string, fileCount: number): Reciter {
    const info = this.db.prepare('INSERT INTO reciters (name, riwaya, infohash, magnet, file_count) VALUES (?, ?, ?, ?, ?)').run(name, riwaya, infohash, magnet, fileCount);
    return this.get(Number(info.lastInsertRowid))!;
  }

  get(id: number): Reciter | null {
    const r = this.db.prepare('SELECT * FROM reciters WHERE id = ?').get(id) as any;
    if (!r) return null;
    return { id: r.id, name: r.name, riwaya: r.riwaya, infohash: r.infohash, magnet: r.magnet, fileCount: r.file_count, createdAt: r.created_at };
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM reciters WHERE id = ?').run(id);
  }
}
