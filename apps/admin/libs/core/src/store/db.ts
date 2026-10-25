import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type Db = Database.Database;

const MIGRATIONS_DIR = join(__dirname, 'migrations');

/**
 * Open the database and bring the schema up to date.
 *
 * WAL plus a 5s busy timeout is what makes two processes (the API and the MCP
 * server, topology A) able to share one file: writers serialise, and a caller
 * waits rather than failing with SQLITE_BUSY.
 */
export function openDatabase(path: string): Db {
  // SQLite will not create a missing directory, and the deploy path (/data) and
  // the local path (./data) are both mounted directories that may not exist yet
  // on a first boot. Creating it here keeps every caller out of that failure.
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL'); // WAL-safe, and cheaper than FULL
  migrate(db);
  return db;
}

/**
 * Apply every not-yet-applied migration in filename order, each inside an
 * IMMEDIATE transaction. Forward-only: an applied file is never re-run, so never
 * edit one.
 *
 * The "is it applied?" question is asked **inside** the write lock, not before it.
 * Reading the applied set up front looks equivalent and is not: two processes
 * starting together (this deployment starts `api` and `mcp` at the same moment
 * against one shared file) both read "003 pending", the first commits, and the
 * second then runs `ALTER TABLE … ADD COLUMN` on a column that now exists —
 * `duplicate column name`, and a container that will not boot. Checking after the
 * lock is held means the loser sees the winner's commit and skips.
 */
export function migrate(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    // better-sqlite3 owns the transaction; `.immediate()` gives BEGIN IMMEDIATE
    // (write lock up front) without a manual BEGIN, which SQLite rejects inside
    // an existing transaction.
    const run = db.transaction(() => {
      const already = db.prepare('SELECT 1 AS n FROM schema_migrations WHERE name = ?').get(file);
      if (already) return false;
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
      return true;
    });

    try {
      run.immediate();
    } catch (error) {
      throw new Error(`migration ${file} failed: ${(error as Error).message}`);
    }
  }
}

export function appliedMigrations(db: Db): string[] {
  return db
    .prepare('SELECT name FROM schema_migrations ORDER BY name')
    .all()
    .map((row) => (row as { name: string }).name);
}
