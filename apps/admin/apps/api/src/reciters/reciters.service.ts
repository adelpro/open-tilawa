import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import type { Db } from '@tilawa-admin/core';
import { RECITER_NAMES_AR } from './reciter-names';

export interface Reciter {
  id: number;
  name: string;
  /** Arabic display name; null until seeded or entered in the console. */
  nameAr: string | null;
  riwaya: string;
  infohash: string;
  magnet: string;
  fileCount: number;
  /** Release size in bytes; null until known (import fills it from the node). */
  sizeBytes: number | null;
  /** Whether the public player lists this row. Curation, not deletion. */
  published: boolean;
  createdAt: string;
}

@Injectable()
export class RecitersService {
  constructor(@Inject(SQLITE_DB) private readonly db: Db) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reciters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        riwaya TEXT NOT NULL DEFAULT 'unknown',
        infohash TEXT NOT NULL,
        magnet TEXT NOT NULL,
        file_count INTEGER NOT NULL DEFAULT 0,
        size_bytes INTEGER,
        published INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    const cols = (this.db.pragma('table_info(reciters)') as { name: string }[]).map((c) => c.name);
    if (!cols.includes('size_bytes'))
      this.db.exec('ALTER TABLE reciters ADD COLUMN size_bytes INTEGER');
    if (!cols.includes('name_ar')) this.db.exec('ALTER TABLE reciters ADD COLUMN name_ar TEXT');
    if (!cols.includes('published'))
      this.db.exec('ALTER TABLE reciters ADD COLUMN published INTEGER NOT NULL DEFAULT 1');

    this.seedArabicNames();
  }

  /** Fill only the rows nobody has named yet; an edit in the console wins. */
  private seedArabicNames(): void {
    const update = this.db.prepare(
      'UPDATE reciters SET name_ar = ? WHERE lower(infohash) = ? AND name_ar IS NULL',
    );
    for (const [hash, name] of Object.entries(RECITER_NAMES_AR)) update.run(name, hash);
  }

  list(): Reciter[] {
    return this.db
      .prepare('SELECT * FROM reciters ORDER BY id')
      .all()
      .map((r: any) => this.mapRow(r));
  }

  /** What the public player may show: curated, not merely present. */
  listPublished(): Reciter[] {
    return this.db
      .prepare('SELECT * FROM reciters WHERE published = 1 ORDER BY id')
      .all()
      .map((r: any) => this.mapRow(r));
  }

  private mapRow(r: any): Reciter {
    return {
      id: r.id,
      name: r.name,
      nameAr: (r.name_ar as string | null) ?? null,
      riwaya: r.riwaya,
      infohash: r.infohash,
      magnet: r.magnet,
      fileCount: r.file_count,
      sizeBytes: (r.size_bytes as number | null) ?? null,
      published: r.published !== 0,
      createdAt: r.created_at,
    };
  }

  add(input: {
    name: string;
    nameAr?: string | null;
    riwaya: string;
    infohash: string;
    magnet: string;
    fileCount: number;
    sizeBytes?: number | null;
    published?: boolean;
  }): Reciter {
    const info = this.db
      .prepare(
        'INSERT INTO reciters (name, name_ar, riwaya, infohash, magnet, file_count, size_bytes, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        input.name,
        input.nameAr?.trim() || null,
        input.riwaya,
        input.infohash,
        input.magnet,
        input.fileCount,
        input.sizeBytes ?? null,
        input.published === false ? 0 : 1,
      );
    return this.get(Number(info.lastInsertRowid))!;
  }

  /**
   * Partial edit. The catalogue is the source of truth, so a wrong name, a new
   * magnet or a size learned from a node must be fixable without deleting the
   * row (which would break the reciter↔torrent record entirely).
   */
  update(
    id: number,
    input: {
      name?: string;
      nameAr?: string | null;
      riwaya?: string;
      infohash?: string;
      magnet?: string;
      fileCount?: number;
      sizeBytes?: number | null;
      published?: boolean;
    },
  ): Reciter | null {
    if (!this.get(id)) return null;
    const sets: string[] = [];
    const values: unknown[] = [];
    const put = (column: string, value: unknown): void => {
      sets.push(`${column} = ?`);
      values.push(value);
    };
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error('the name cannot be empty');
      put('name', name);
    }
    if (input.nameAr !== undefined) put('name_ar', input.nameAr?.trim() || null);
    if (input.riwaya !== undefined) put('riwaya', input.riwaya.trim() || 'unknown');
    if (input.infohash !== undefined) {
      const infohash = input.infohash.trim();
      if (!infohash) throw new Error('the infohash cannot be empty');
      put('infohash', infohash);
    }
    if (input.magnet !== undefined) put('magnet', input.magnet.trim());
    if (input.fileCount !== undefined) put('file_count', input.fileCount);
    if (input.sizeBytes !== undefined) put('size_bytes', input.sizeBytes);
    if (input.published !== undefined) put('published', input.published ? 1 : 0);
    if (sets.length > 0) {
      this.db.prepare(`UPDATE reciters SET ${sets.join(', ')} WHERE id = ?`).run(...values, id);
    }
    return this.get(id);
  }

  get(id: number): Reciter | null {
    const r = this.db.prepare('SELECT * FROM reciters WHERE id = ?').get(id) as any;
    if (!r) return null;
    return this.mapRow(r);
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM reciters WHERE id = ?').run(id);
  }
}
