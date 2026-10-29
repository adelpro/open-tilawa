-- 019_alerts.sql — operator alerts.
--
-- Forward-only. Never edit an applied migration; add a new file.
--
-- One row per condition, resolved in place. The partial unique index is the
-- dedupe: two API processes share this database (api and mcp start together), so
-- "at most one open alert per kind and subject" has to be a constraint rather
-- than a check in application code that can race itself.

CREATE TABLE IF NOT EXISTS alerts (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  kind                 TEXT    NOT NULL,
  subject              TEXT    NOT NULL,
  title                TEXT    NOT NULL,
  detail               TEXT,
  state                TEXT    NOT NULL DEFAULT 'open'
                       CHECK (state IN ('open', 'resolved')),
  opened_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  notified_at          TEXT,
  notify_error         TEXT,
  resolved_at          TEXT,
  resolved_notified_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS alerts_one_open
  ON alerts (kind, subject)
  WHERE state = 'open';

CREATE INDEX IF NOT EXISTS alerts_recent ON alerts (id DESC);
