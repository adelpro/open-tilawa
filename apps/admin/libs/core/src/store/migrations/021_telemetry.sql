-- Telemetry: what the player reports about its own health.
--
-- Two tables, two lifetimes. `telemetry_events` is the raw event and is deleted after
-- ninety days; `telemetry_daily` is a count per day and is kept, because the question
-- "how much did Ramadan cost" is asked a year later and the events are long gone.
--
-- There is no column for an IP address, a user agent, a session, an install or a playhead
-- position. That is the whole promise: a row says what happened, never who it happened to.
-- `apps/admin/apps/api/src/telemetry/telemetry.service.ts` enforces the field list, and a
-- test asserts this table's shape so a column cannot be added quietly.

CREATE TABLE IF NOT EXISTS telemetry_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  event       TEXT    NOT NULL,
  reciter     TEXT    NOT NULL,
  surah       INTEGER NOT NULL,
  source      TEXT    NOT NULL,
  error_code  TEXT,
  ms_to_play  TEXT,
  version     TEXT    NOT NULL,
  locale      TEXT    NOT NULL
);

-- The prune walks this index; without it the ninety-day delete is a full scan.
CREATE INDEX IF NOT EXISTS telemetry_events_at ON telemetry_events (at);
CREATE INDEX IF NOT EXISTS telemetry_events_reciter ON telemetry_events (reciter, surah);

-- Counts only: no free text, no identifier, no version except where a regression lives.
CREATE TABLE IF NOT EXISTS telemetry_daily (
  day        TEXT    NOT NULL,
  reciter    TEXT    NOT NULL,
  surah      INTEGER NOT NULL,
  event      TEXT    NOT NULL,
  source     TEXT    NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, reciter, surah, event, source)
);

CREATE TABLE IF NOT EXISTS telemetry_errors_daily (
  day        TEXT    NOT NULL,
  version    TEXT    NOT NULL,
  error_code TEXT    NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, version, error_code)
);

-- What the console reads to say when the prune last ran. A stopped job should be visible,
-- not inferred from a table that quietly stopped shrinking.
CREATE TABLE IF NOT EXISTS telemetry_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
