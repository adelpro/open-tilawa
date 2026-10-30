import { closeSync, openSync, readSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from '@tilawa-admin/core';

import { dayFromFile, parseMediaLines } from './media-log';

/** The offset each file was read to, so a second pass reads only what was appended. */
const OFFSET_PREFIX = 'media_offset:';

/** A finished file stops being useful once it is ingested; two days is slack for a missed pass. */
const KEEP_DAYS = 2;

export type MediaImportResult = { files: number; rows: number; bytes: number };

/**
 * The exact half of the volume figure: bytes nginx sent from `/media`.
 *
 * The log is appended to by the web container and read here, so the reader has to
 * be at-least-once rather than magical: each file's byte offset is kept in
 * `telemetry_state`, a partial trailing line is left for the next pass, and a
 * file that got shorter (rotated, replaced) is read from the start again. A
 * failed pass loses nothing, because the offset only moves after the rows are
 * written.
 *
 * The day comes from the file name, not from a clock at read time: a pass that
 * runs just after midnight is still reading yesterday's file, and attributing
 * those bytes to today would move a day of traffic.
 */
export class MediaLogImporter {
  constructor(
    private readonly db: Db,
    private readonly dir: string = process.env.MEDIA_LOG_DIR ?? '/var/log/tilawa',
    private readonly now: () => Date = () => new Date(),
  ) {}

  run(): MediaImportResult {
    const result: MediaImportResult = { files: 0, rows: 0, bytes: 0 };

    let names: string[];
    try {
      names = readdirSync(this.dir);
    } catch {
      // No directory is a deployment without the mount, not an error to log every hour.
      return result;
    }

    for (const name of names.sort()) {
      const day = dayFromFile(name);
      if (!day) continue;
      const file = this.read(join(this.dir, name), day, name);
      if (!file) continue;
      result.files += 1;
      result.rows += file.rows;
      result.bytes += file.bytes;
    }

    this.prune(names);
    return result;
  }

  /** Read one file from its offset; `null` when there was nothing new or no full line. */
  private read(path: string, day: string, name: string): { rows: number; bytes: number } | null {
    let size: number;
    try {
      size = statSync(path).size;
    } catch {
      return null;
    }

    const key = OFFSET_PREFIX + name;
    const saved = Number(this.state(key) ?? '0');
    // A file shorter than its offset was replaced: start again rather than skip its head.
    const from = Number.isFinite(saved) && saved > 0 && saved <= size ? saved : 0;
    if (size <= from) return null;

    const buffer = Buffer.alloc(size - from);
    const fd = openSync(path, 'r');
    try {
      readSync(fd, buffer, 0, buffer.length, from);
    } finally {
      closeSync(fd);
    }

    // Only whole lines: a line still being written must not be parsed twice.
    const end = buffer.lastIndexOf(0x0a);
    if (end < 0) return null;

    const lines = buffer
      .subarray(0, end + 1)
      .toString('utf8')
      .split('\n')
      .filter(Boolean);
    const totals = new Map<string, number>();
    for (const line of parseMediaLines(lines)) {
      const id = `${line.reciter}/${line.surah}`;
      totals.set(id, (totals.get(id) ?? 0) + line.bytes);
    }

    const upsert = this.db.prepare(
      `INSERT INTO media_daily (day, folder, surah, bytes) VALUES (?, ?, ?, ?)
       ON CONFLICT(day, folder, surah) DO UPDATE SET bytes = bytes + excluded.bytes`,
    );
    let bytes = 0;
    this.db.transaction(() => {
      for (const [id, count] of totals) {
        const slash = id.lastIndexOf('/');
        const folder = id.slice(0, slash);
        const surah = Number(id.slice(slash + 1));
        upsert.run(day, folder, surah, count);
        bytes += count;
      }
      this.writeState(key, String(from + end + 1));
    })();

    return { rows: totals.size, bytes };
  }

  /** Files older than the slack window are ingested; drop them so the volume does not grow forever. */
  private prune(names: string[]): void {
    const today = this.now();
    const cutoff = new Date(today.getTime() - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    for (const name of names) {
      const day = dayFromFile(name);
      if (!day || day >= cutoff) continue;
      try {
        unlinkSync(join(this.dir, name));
        this.db.prepare('DELETE FROM telemetry_state WHERE key = ?').run(OFFSET_PREFIX + name);
      } catch {
        // Leaving one file behind is cheaper than failing the pass that ingested it.
      }
    }
  }

  private state(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM telemetry_state WHERE key = ?').get(key) as
      { value: string } | undefined;
    return row?.value ?? null;
  }

  private writeState(key: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO telemetry_state (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, value);
  }
}
