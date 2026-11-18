-- SFTP backup destinations the console can check and browse.
--
-- The credential is deliberately absent: it lives in the backup-bridge volume,
-- because this database is inside the container that holds the Docker socket.
-- What is stored here is only what the screen needs to render a row and to ask
-- the bridge a question — never the password or private key.
CREATE TABLE IF NOT EXISTS backup_targets (
  id              TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  host            TEXT NOT NULL,
  port            INTEGER NOT NULL DEFAULT 22,
  username        TEXT NOT NULL,
  remote_dir      TEXT NOT NULL,
  enabled         INTEGER NOT NULL DEFAULT 1,
  last_state      TEXT,
  last_checked_at TEXT,
  last_error      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
