-- Avatars live in the row that owns them.
--
-- Bytes in the database rather than files on the volume: `deploy.sh` already
-- snapshots this file, so an avatar is backed up by the same mechanism as the
-- account it belongs to, with no second directory to create uid-1000-writable and
-- no orphaned files when an account is deleted (ON DELETE CASCADE takes the row).
--
-- `avatar_blob` is deliberately NOT selected by the ordinary user queries: it is
-- only ever read by the one route that serves it, so a 100 KB photograph never
-- travels through /me, the admin list or a profile response.
ALTER TABLE users ADD COLUMN avatar_blob BLOB;
ALTER TABLE users ADD COLUMN avatar_mime TEXT;
ALTER TABLE users ADD COLUMN avatar_updated_at TEXT;
