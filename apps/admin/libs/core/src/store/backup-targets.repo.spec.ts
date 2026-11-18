import { openDatabase } from './db';
import { BackupTargetsRepository, type BackupTarget } from './backup-targets.repo';

const target: BackupTarget = {
  id: 't1',
  label: 'Pharmacy',
  host: 'pharmacyserver',
  port: 22,
  username: 'adelpro',
  remoteDir: 'tilawa-backups',
  enabled: true,
  lastState: null,
  lastCheckedAt: null,
  lastError: null,
  createdAt: '2026-11-18T00:00:00.000Z',
  updatedAt: '2026-11-18T00:00:00.000Z',
};

describe('backup targets repository', () => {
  it('stores metadata and never a secret column', () => {
    const db = openDatabase(':memory:');
    const columns = (db.prepare('PRAGMA table_info(backup_targets)').all() as { name: string }[]).map(
      (column) => column.name,
    );
    expect(columns).not.toContain('password');
    expect(columns).not.toContain('secret');
    expect(columns).not.toContain('private_key');
    db.close();
  });

  it('round-trips a target and its health', () => {
    const db = openDatabase(':memory:');
    const repo = new BackupTargetsRepository(db);
    repo.upsert(target);
    expect(repo.list()).toEqual([target]);

    repo.setHealth('t1', 'failed', '2026-11-18T01:00:00.000Z', 'timeout');
    expect(repo.get('t1')).toMatchObject({
      lastState: 'failed',
      lastCheckedAt: '2026-11-18T01:00:00.000Z',
      lastError: 'timeout',
    });

    repo.remove('t1');
    expect(repo.list()).toEqual([]);
    db.close();
  });
});
