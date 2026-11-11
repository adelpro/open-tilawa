-- The rollup gains the dimension it is asked to filter by.
--
-- `telemetry_daily` was keyed without `version`, so the console could not answer
-- "which release" from it and read `telemetry_events` instead. That made the rollup
-- decorative: it held every day the raw table had and no day the raw table had lost,
-- and the screen promised a year while the table was deleted at ninety days.
--
-- Rebuilt rather than altered: SQLite cannot add a column to a primary key, and the key
-- is the thing that changed. The rebuild is lossless because every day in the old table
-- still has its raw rows — check with:
--   SELECT day FROM telemetry_daily
--    WHERE day NOT IN (SELECT DISTINCT substr(at, 1, 10) FROM telemetry_events);
-- which returned no rows on the live database before this migration was written.
--
-- `count` stays the only measure. No identifier, no session, no position: a row still
-- says what happened, never who it happened to.

DROP TABLE IF EXISTS telemetry_daily;

CREATE TABLE telemetry_daily (
  day        TEXT    NOT NULL,
  version    TEXT    NOT NULL,
  reciter    TEXT    NOT NULL,
  surah      INTEGER NOT NULL,
  event      TEXT    NOT NULL,
  source     TEXT    NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, version, reciter, surah, event, source)
);

-- Every read starts with a window, so the day is the only index that earns its keep;
-- the primary key covers the grouped dimensions that follow it.
CREATE INDEX IF NOT EXISTS telemetry_daily_day ON telemetry_daily (day);

-- Backfill from the raw rows, which the ninety-day prune has not reached yet.
INSERT INTO telemetry_daily (day, version, reciter, surah, event, source, count)
SELECT substr(at, 1, 10), version, reciter, surah, event, source, count(*)
  FROM telemetry_events
 GROUP BY substr(at, 1, 10), version, reciter, surah, event, source;
