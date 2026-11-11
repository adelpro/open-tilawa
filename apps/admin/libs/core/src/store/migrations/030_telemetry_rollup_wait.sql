-- The rollup learns how long the wait was.
--
-- `ms_to_play` is captured on every play and, until now, read by nothing: the screen
-- could say how many plays happened but not whether they started instantly. The band is
-- a four-value dimension, so it belongs in the key beside the others rather than in a
-- second table; one rollup that answers everything beats two that have to agree.
--
-- Empty string, not NULL: SQLite treats NULLs as distinct in a primary key, which would
-- let the same day be counted twice. Non-play events carry the empty band.
--
-- Lossless for the same reason as 028: every day in the old table still has its raw rows.

DROP TABLE IF EXISTS telemetry_daily;

CREATE TABLE telemetry_daily (
  day        TEXT    NOT NULL,
  version    TEXT    NOT NULL,
  reciter    TEXT    NOT NULL,
  surah      INTEGER NOT NULL,
  event      TEXT    NOT NULL,
  source     TEXT    NOT NULL,
  ms_to_play TEXT    NOT NULL DEFAULT '',
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, version, reciter, surah, event, source, ms_to_play)
);

CREATE INDEX IF NOT EXISTS telemetry_daily_day ON telemetry_daily (day);

INSERT INTO telemetry_daily (day, version, reciter, surah, event, source, ms_to_play, count)
SELECT substr(at, 1, 10), version, reciter, surah, event, source,
       coalesce(ms_to_play, ''), count(*)
  FROM telemetry_events
 GROUP BY substr(at, 1, 10), version, reciter, surah, event, source,
          coalesce(ms_to_play, '');
