import { appendFileSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { openDatabase, type Db } from '@tilawa-admin/core';

import { MediaLogImporter } from '../src/telemetry/media-import';

/**
 * The importer is the one place where a byte count is read from a file that is
 * still being written. The rules that keep it honest are all here: read only
 * whole lines, keep the offset across passes, start over on a shorter file, and
 * take the day from the file name rather than from the clock.
 */
const line = (path: string, bytes: number, status = '206'): string =>
  `"GET ${path} HTTP/2.0" ${status} ${bytes}\n`;

const DAY = '2026-10-30';
const NAME = `media-open-tilawa-web-${DAY}.log`;
const NOW = () => new Date('2026-10-30T12:00:00Z');

function setup(): { db: Db; dir: string; importer: MediaLogImporter } {
  const db = openDatabase(':memory:');
  const dir = mkdtempSync(join(tmpdir(), 'tilawa-media-'));
  return { db, dir, importer: new MediaLogImporter(db, dir, NOW) };
}
const rows = (db: Db) =>
  db.prepare('SELECT day, folder, surah, bytes FROM media_daily ORDER BY surah').all() as {
    day: string;
    folder: string;
    surah: number;
    bytes: number;
  }[];

describe('MediaLogImporter', () => {
  it('counts the bytes of one surah and reads only what was appended next time', () => {
    const { db, dir, importer } = setup();
    const file = join(dir, NAME);
    writeFileSync(file, line('/media/maher/018.mp3', 1_000));

    expect(importer.run()).toMatchObject({ files: 1, rows: 1, bytes: 1_000 });
    expect(rows(db)).toEqual([{ day: DAY, folder: 'maher', surah: 18, bytes: 1_000 }]);

    // Nothing new: a pass must not double-count what it already saw.
    expect(importer.run()).toMatchObject({ files: 0, rows: 0, bytes: 0 });
    expect(rows(db)[0].bytes).toBe(1_000);

    appendFileSync(file, line('/media/maher/018.mp3', 500) + line('/media/maher/002.mp3', 700));

    expect(importer.run()).toMatchObject({ files: 1, rows: 2, bytes: 1_200 });
    expect(rows(db)).toEqual([
      { day: DAY, folder: 'maher', surah: 2, bytes: 700 },
      { day: DAY, folder: 'maher', surah: 18, bytes: 1_500 },
    ]);
  });

  it('waits for the newline before counting a line', () => {
    const { db, dir, importer } = setup();
    const file = join(dir, NAME);
    const complete = line('/media/maher/018.mp3', 1_000);
    writeFileSync(file, complete + '"GET /media/maher/002.mp3 HTTP/2.0" 206 700');

    importer.run();
    expect(rows(db)).toEqual([{ day: DAY, folder: 'maher', surah: 18, bytes: 1_000 }]);

    appendFileSync(file, '\n');
    importer.run();
    expect(rows(db).map((row) => row.surah)).toEqual([2, 18]);
  });

  it('reads a replaced file from the start instead of skipping its head', () => {
    const { dir, db, importer } = setup();
    const file = join(dir, NAME);

    writeFileSync(file, line('/media/maher/018.mp3', 10_000));
    importer.run();
    // A shorter file (rotated, replaced) is not "already read".
    writeFileSync(file, line('/media/maher/002.mp3', 70));
    importer.run();

    expect(rows(db)).toEqual([
      { day: DAY, folder: 'maher', surah: 2, bytes: 70 },
      { day: DAY, folder: 'maher', surah: 18, bytes: 10_000 },
    ]);
  });

  it('deletes a file once its bytes are in, and leaves an old one alone until then', () => {
    const { dir, importer } = setup();
    writeFileSync(join(dir, 'media-web-2026-10-20.log'), line('/media/maher/018.mp3', 5));
    writeFileSync(join(dir, NAME), line('/media/maher/018.mp3', 5));

    importer.run();

    expect(readdirSync(dir)).toEqual([NAME]);
  });

  it('ignores a file whose name carries no day', () => {
    const { dir, importer } = setup();
    writeFileSync(join(dir, 'access.log'), line('/media/maher/018.mp3', 5));
    expect(importer.run()).toMatchObject({ files: 0, rows: 0 });
  });

  it('is quiet when the log directory does not exist', () => {
    const { db } = setup();
    const importer = new MediaLogImporter(db, '/nonexistent/tilawa', NOW);
    expect(importer.run()).toMatchObject({ files: 0, rows: 0, bytes: 0 });
  });
});
