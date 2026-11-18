import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import Database from 'better-sqlite3';

import { BackupsService } from '../src/backups/backups.service';

const NAME = 'tilawa-admin-20261101T000000Z.sqlite';

function makeDb(path: string, reciters: number, torrents: number): void {
  const db = new Database(path);
  db.exec('CREATE TABLE reciters (id INTEGER); CREATE TABLE torrents (id INTEGER);');
  for (let i = 0; i < reciters; i += 1) db.prepare('INSERT INTO reciters VALUES (?)').run(i);
  for (let i = 0; i < torrents; i += 1) db.prepare('INSERT INTO torrents VALUES (?)').run(i);
  db.close();
}

describe('backups restore summary', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tilawa-backup-summary-'));
    makeDb(join(dir, NAME), 1, 2);
    makeDb(join(dir, 'live.sqlite'), 3, 1);
    process.env.BACKUP_DIR = dir;
    process.env.DB_PATH = join(dir, 'live.sqlite');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.BACKUP_DIR;
    delete process.env.DB_PATH;
  });

  it('counts only allow-listed tables in the snapshot and the live database', async () => {
    const summary = await new BackupsService().summary(NAME);
    expect(summary.tables).toEqual([
      { name: 'reciters', snapshot: 1, current: 3 },
      { name: 'torrents', snapshot: 2, current: 1 },
      { name: 'users', snapshot: 0, current: 0 },
      { name: 'seeders', snapshot: 0, current: 0 },
    ]);
  });

  it('refuses a name that is not one of our snapshots', async () => {
    await expect(new BackupsService().summary('../../etc/passwd')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
