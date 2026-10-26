-- 016_drop_uslub_tables.sql — the writing-profile schema the fork inherited.
--
-- These tables belong to the product this instance no longer is: profiles,
-- documents, gate runs, learned preferences and API keys were all removed with
-- their code. On an upgraded database they are empty leftovers; on a fresh one
-- they are noise nobody can reach. `audit_log` is rebuilt first so its
-- `key_id` reference to `api_keys` goes away with the table, and the trail
-- itself is preserved row for row.

CREATE TABLE audit_log_next (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT    NOT NULL,
  target      TEXT,
  before_json TEXT,
  after_json  TEXT,
  tool        TEXT,
  status      TEXT    NOT NULL DEFAULT 'ok',
  ms          INTEGER,
  ip          TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO audit_log_next (id, user_id, actor_id, action, target, before_json, after_json, tool, status, ms, ip, created_at)
  SELECT id, user_id, actor_id, action, target, before_json, after_json, tool, status, ms, ip, created_at
  FROM audit_log;

DROP TABLE audit_log;
ALTER TABLE audit_log_next RENAME TO audit_log;

CREATE INDEX idx_audit_user ON audit_log(user_id, created_at);
CREATE INDEX idx_audit_action ON audit_log(action, created_at);

DROP TABLE IF EXISTS gate_runs;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS preferences;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS api_keys;

-- The other dead half: OAuth identities/clients (the MCP OAuth server), invites
-- and the local torrents catalogue. None of them has a repository or a route
-- any more; a live database keeps the rows only because SQLite never forgets.
DROP TABLE IF EXISTS user_identities;
DROP TABLE IF EXISTS oauth_refresh_tokens;
DROP TABLE IF EXISTS oauth_authorization_codes;
DROP TABLE IF EXISTS oauth_clients;
DROP TABLE IF EXISTS invites;
DROP TABLE IF EXISTS torrents;
