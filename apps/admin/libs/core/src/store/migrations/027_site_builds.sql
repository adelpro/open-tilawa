-- Rebuilding the public site from the console.
--
-- The deployed site describes itself in /site-version.json, so this table is not
-- the source of "is the site current" — the diff is. It exists for the states a
-- diff cannot hold: a build is running, and the last build failed with an error
-- worth showing. One row per attempt, because a failure that vanished on refresh
-- would look like a success.

CREATE TABLE IF NOT EXISTS site_builds (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  status         TEXT NOT NULL DEFAULT 'running'
                 CHECK (status IN ('running', 'ok', 'failed')),
  actor_id       INTEGER,
  started_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at    TEXT,
  error          TEXT,
  deployed_count INTEGER
);

CREATE INDEX IF NOT EXISTS site_builds_started ON site_builds (started_at DESC);

-- Two operators pressing the button at the same moment must not start two builds
-- against one daemon. The status check is the friendly guard; this is the truth.
CREATE UNIQUE INDEX IF NOT EXISTS site_builds_one_running
  ON site_builds (status)
  WHERE status = 'running';
