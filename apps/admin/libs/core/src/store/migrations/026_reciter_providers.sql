-- Where a catalogue release came from, and the state of an import job.
--
-- The row stays the unit: one person, one riwaya, one torrent. The provider ids
-- are metadata beside it, not a second catalogue. `provider_variant` separates
-- Itqan's folders (default / with-fx) for the same recitation id; it is part of
-- the uniqueness rule so both may be linked.
--
-- Infohash and magnet stay NOT NULL: a provider row that has not been seeded yet
-- stores ''. The public list excludes empty magnets, so a draft can never reach
-- the player.

ALTER TABLE reciters ADD COLUMN provider TEXT;
ALTER TABLE reciters ADD COLUMN provider_reciter_id TEXT;
ALTER TABLE reciters ADD COLUMN provider_release_id TEXT;
ALTER TABLE reciters ADD COLUMN provider_variant TEXT NOT NULL DEFAULT '';
ALTER TABLE reciters ADD COLUMN import_job TEXT;
ALTER TABLE reciters ADD COLUMN import_state TEXT;
ALTER TABLE reciters ADD COLUMN import_progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reciters ADD COLUMN import_error TEXT;
ALTER TABLE reciters ADD COLUMN import_seeder_id INTEGER;
ALTER TABLE reciters ADD COLUMN import_folder TEXT;
ALTER TABLE reciters ADD COLUMN import_publish INTEGER NOT NULL DEFAULT 0;

-- One provider release per row. A re-torrent updates the row; it never creates a
-- second row for the same recording.
CREATE UNIQUE INDEX IF NOT EXISTS reciters_provider_release
  ON reciters (provider, provider_release_id, provider_variant)
  WHERE provider IS NOT NULL AND provider_release_id IS NOT NULL;
