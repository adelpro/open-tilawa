import type { Db } from './db';

/**
 * SFTP destinations, as metadata only.
 *
 * The credential never enters this table: it is written to the bridge's own
 * volume through the bridge API. A row here is safe to read from the console.
 */
export interface BackupTarget {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  remoteDir: string;
  enabled: boolean;
  lastState: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  remote_dir: string;
  enabled: number;
  last_state: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: Row): BackupTarget {
  return {
    id: row.id,
    label: row.label,
    host: row.host,
    port: row.port,
    username: row.username,
    remoteDir: row.remote_dir,
    enabled: row.enabled === 1,
    lastState: row.last_state,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BackupTargetsRepository {
  constructor(private readonly db: Db) {}

  list(): BackupTarget[] {
    return (this.db.prepare('SELECT * FROM backup_targets ORDER BY label').all() as Row[]).map(fromRow);
  }

  get(id: string): BackupTarget | null {
    const row = this.db.prepare('SELECT * FROM backup_targets WHERE id = ?').get(id) as Row | undefined;
    return row ? fromRow(row) : null;
  }

  upsert(target: BackupTarget): void {
    this.db
      .prepare(
        `INSERT INTO backup_targets
           (id, label, host, port, username, remote_dir, enabled, last_state,
            last_checked_at, last_error, created_at, updated_at)
         VALUES
           (@id, @label, @host, @port, @username, @remoteDir, @enabled, @lastState,
            @lastCheckedAt, @lastError, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           label = excluded.label,
           host = excluded.host,
           port = excluded.port,
           username = excluded.username,
           remote_dir = excluded.remote_dir,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
      )
      .run({
        ...target,
        enabled: target.enabled ? 1 : 0,
      });
  }

  setHealth(id: string, state: string, checkedAt: string, error: string | null): void {
    this.db
      .prepare(
        `UPDATE backup_targets
            SET last_state = ?, last_checked_at = ?, last_error = ?, updated_at = ?
          WHERE id = ?`,
      )
      .run(state, checkedAt, error, checkedAt, id);
  }

  remove(id: string): void {
    this.db.prepare('DELETE FROM backup_targets WHERE id = ?').run(id);
  }
}
