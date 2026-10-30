-- A slug per release: the public face of the infohash.
--
-- The catalogue row is a release, not a person: الحصري has three rows (hafs, warsh,
-- qalon) and المنشاوي two, so a slug derived from the display name could not be unique
-- on the day it was introduced. The infohash is the only stable join, and these two
-- tables keep the slug attached to it rather than to the row id, which is
-- AUTOINCREMENT and dies with a re-seed.
--
-- `slug` is nullable here on purpose: there is no way to compute it in SQL, so the
-- service backfills it at startup, ordered by infohash so two runs of the same database
-- produce the same assignment. The unique index is created before that backfill, which
-- is what makes a second backfill a no-op rather than a silent overwrite.

ALTER TABLE reciters ADD COLUMN slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS reciters_slug ON reciters (slug);

-- Append-only. A retired slug stays here with a `retired_at`, so an inbound link from
-- last year still resolves after the operator renames a reciter; the row is never
-- deleted and the slug is never handed to a different release.
CREATE TABLE IF NOT EXISTS reciter_slugs (
  slug       TEXT PRIMARY KEY,
  infohash   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  retired_at TEXT
);

CREATE INDEX IF NOT EXISTS reciter_slugs_infohash ON reciter_slugs (lower(infohash));
