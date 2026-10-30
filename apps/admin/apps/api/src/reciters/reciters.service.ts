import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SQLITE_DB } from '../store/store.module';
import { deriveReciterState, type Db, type ReciterState } from '@tilawa-admin/core';
import { RECITER_NAMES_AR } from './reciter-names';
import { assignSlug, slugify } from './slug';

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
  /** The public face of the infohash; assigned once, frozen after that. */
  slug: string;
  createdAt: string;
}

/** One node's answer about one reciter. */
export interface ReciterPlacement {
  seederId: number;
  seederName: string;
  state: 'pending' | 'placed' | 'failed';
  error: string | null;
}

/** A catalogue row plus where it actually lives — the whole point of the screen. */
export interface ReciterWithPlacement extends Reciter {
  heldBy: { seederId: number; name: string }[];
  placements: ReciterPlacement[];
  state: ReciterState;
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
    this.ensureSlugs();
  }

  /**
   * Fill only the rows that have no slug yet, in infohash order.
   *
   * Ordered by infohash rather than by id so the same database always produces the same
   * assignment, whatever order the rows were imported in — the backfill has to be
   * repeatable, and a second run must change nothing.
   */
  private ensureSlugs(): void {
    const taken = new Set(
      (this.db.prepare('SELECT slug FROM reciters WHERE slug IS NOT NULL').all() as {
        slug: string;
      }[]).map((row) => row.slug),
    );
    const pending = this.db
      .prepare('SELECT id, name, riwaya, infohash FROM reciters WHERE slug IS NULL ORDER BY lower(infohash)')
      .all() as { id: number; name: string; riwaya: string; infohash: string }[];

    const update = this.db.prepare('UPDATE reciters SET slug = ? WHERE id = ?');
    const record = this.db.prepare(
      'INSERT OR IGNORE INTO reciter_slugs (slug, infohash) VALUES (?, ?)',
    );

    for (const row of pending) {
      const slug = assignSlug(slugify(row.name), row.riwaya, row.infohash, taken);
      update.run(slug, row.id);
      record.run(slug, row.infohash.toLowerCase());
      taken.add(slug);
    }
  }

  /** Fill only the rows nobody has named yet; an edit in the console wins. */
  private seedArabicNames(): void {
    const update = this.db.prepare(
      'UPDATE reciters SET name_ar = ? WHERE lower(infohash) = ? AND name_ar IS NULL',
    );
    for (const [hash, name] of Object.entries(RECITER_NAMES_AR)) update.run(name, hash);
  }

  /**
   * The successor of a slug, or null when nobody ever had it.
   *
   * `reciter_slugs` is append-only, so a slug retired by a rename still points at its
   * infohash; the current row is the one that infohash holds now. A slug that resolves to
   * itself is the ordinary case and returns itself, which is what keeps a redirect from
   * looping.
   */
  resolveSlug(slug: string): string | null {
    const known = this.db
      .prepare('SELECT lower(infohash) AS infohash FROM reciter_slugs WHERE slug = ?')
      .get(slug) as { infohash: string } | undefined;
    if (!known) return null;

    const current = this.db
      .prepare('SELECT slug FROM reciters WHERE lower(infohash) = ?')
      .get(known.infohash) as { slug: string | null } | undefined;
    return current?.slug ?? null;
  }

  list(): Reciter[] {
    return this.db
      .prepare('SELECT * FROM reciters ORDER BY id')
      .all()
      .map((r: any) => this.mapRow(r));
  }

  /**
   * The catalogue with its coverage: which nodes report holding each row, what
   * was asked of them, and the resulting state.
   *
   * Two queries and no fan-out — the node inventory is a cache refreshed by the
   * poller, so this stays one statement even with a fleet.
   */
  listWithPlacement(): ReciterWithPlacement[] {
    const rows = this.list();

    const held = this.db
      .prepare(
        `SELECT lower(nt.infohash) AS hash, s.id AS seeder_id, s.name AS seeder_name
         FROM node_torrents nt JOIN seeders s ON s.id = nt.seeder_id`,
      )
      .all() as { hash: string; seeder_id: number; seeder_name: string }[];

    const placements = this.db
      .prepare(
        `SELECT p.reciter_id, p.seeder_id, p.state, p.error, s.name AS seeder_name
         FROM placements p JOIN seeders s ON s.id = p.seeder_id`,
      )
      .all() as {
      reciter_id: number;
      seeder_id: number;
      state: ReciterPlacement['state'];
      error: string | null;
      seeder_name: string;
    }[];

    const heldBy = new Map<string, { seederId: number; name: string }[]>();
    for (const row of held) {
      const list = heldBy.get(row.hash) ?? [];
      list.push({ seederId: row.seeder_id, name: row.seeder_name });
      heldBy.set(row.hash, list);
    }

    const byReciter = new Map<number, ReciterPlacement[]>();
    for (const row of placements) {
      const list = byReciter.get(row.reciter_id) ?? [];
      list.push({
        seederId: row.seeder_id,
        seederName: row.seeder_name,
        state: row.state,
        error: row.error,
      });
      byReciter.set(row.reciter_id, list);
    }

    return rows.map((reciter) => {
      const heldRows = heldBy.get(reciter.infohash.toLowerCase()) ?? [];
      const placed = byReciter.get(reciter.id) ?? [];
      return {
        ...reciter,
        heldBy: heldRows,
        placements: placed,
        state: deriveReciterState({
          published: reciter.published,
          heldByNodes: heldRows.length,
          placements: placed.map((p) => p.state),
        }),
      };
    });
  }

  /** What the public player may show: curated, not merely present. */
  listPublished(): Reciter[] {
    return this.db
      .prepare('SELECT * FROM reciters WHERE published = 1 ORDER BY id')
      .all()
      .map((r: any) => this.mapRow(r));
  }

  listPublishedPaginated(
    offset: number,
    limit: number,
  ): { reciters: Reciter[]; total: number } {
    const totalRow = this.db
      .prepare('SELECT COUNT(*) as count FROM reciters WHERE published = 1')
      .get() as { count: number };
    const reciters = this.db
      .prepare('SELECT * FROM reciters WHERE published = 1 ORDER BY id LIMIT ? OFFSET ?')
      .all(limit, offset)
      .map((r: any) => this.mapRow(r));
    return { reciters, total: totalRow.count };
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
      slug: (r.slug as string | null) ?? '',
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
    const taken = new Set(
      (this.db.prepare('SELECT slug FROM reciters WHERE slug IS NOT NULL').all() as {
        slug: string;
      }[]).map((row) => row.slug),
    );
    const slug = assignSlug(slugify(input.name), input.riwaya, input.infohash, taken);

    const info = this.db
      .prepare(
        'INSERT INTO reciters (name, name_ar, riwaya, infohash, magnet, file_count, size_bytes, published, slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        slug,
      );
    this.db
      .prepare('INSERT OR IGNORE INTO reciter_slugs (slug, infohash) VALUES (?, ?)')
      .run(slug, input.infohash.toLowerCase());
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
