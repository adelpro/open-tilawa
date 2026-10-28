-- The catalogue. Until now this table existed only because
-- RecitersService's constructor ran `CREATE TABLE IF NOT EXISTS` at request
-- time — outside the migration sequence. A fresh database therefore died at
-- 017_unescape_magnets.sql, which is an UPDATE against a table that did not
-- exist yet: "migration 017 failed: no such table: reciters". Production only
-- works because its database predates the gap.
--
-- The slot is 015 (the number the deleted 015_master_prompt.sql used) so this
-- sorts before 017. Migrations are keyed by filename, so renaming 017 instead
-- would make every deployed database re-run the magnet rewrite.
--
-- Mirrors the final shape the service builds, including the columns it used to
-- add afterwards with ALTER TABLE.
CREATE TABLE IF NOT EXISTS reciters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_ar TEXT,
  riwaya TEXT NOT NULL DEFAULT 'unknown',
  infohash TEXT NOT NULL,
  magnet TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
