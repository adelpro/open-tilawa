-- 001_init.sql — the tenancy spine: users and machine credentials.
-- Forward-only. Never edit an applied migration; add a new file.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,                        -- argon2id; null for invite-only accounts before activation
  role          TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','super_admin')),
  tier          TEXT    NOT NULL DEFAULT 'free',
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  profile_picture TEXT,
  cover_image     TEXT,
  about           TEXT,
  social_links    TEXT,                      -- JSON array
  is_activated    INTEGER NOT NULL DEFAULT 0,
  twofa_enabled   INTEGER NOT NULL DEFAULT 0,
  twofa_secret    TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_users_role ON users(role);

-- One row per key. The key itself is never stored: only sha256(pepper + key).
CREATE TABLE api_keys (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        TEXT    NOT NULL,
  key_prefix   TEXT    NOT NULL UNIQUE,      -- first 12 chars, for lookup and display
  key_hash     TEXT    NOT NULL,             -- sha256(pepper + plaintext)
  scopes       TEXT    NOT NULL DEFAULT 'profile:read',  -- comma-separated
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_used_at TEXT,
  expires_at   TEXT,
  revoked_at   TEXT
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);

-- A writing voice. manifest/house-style are the engine's own JSON shapes.
CREATE TABLE profiles (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  is_default       INTEGER NOT NULL DEFAULT 0,
  manifest_json    TEXT    NOT NULL,
  house_style_json TEXT,
  voice_card_md    TEXT,
  sample_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_profiles_user ON profiles(user_id);

-- learned-preferences.json, per profile, so the web app can delete one at a time.
CREATE TABLE preferences (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text       TEXT    NOT NULL,
  source     TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_preferences_profile ON preferences(profile_id);

-- Submitted text, so a tool can accept documentId instead of a path.
CREATE TABLE documents (
  id         TEXT    PRIMARY KEY,            -- opaque id handed to the caller
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_documents_user ON documents(user_id);

-- Exit codes are preserved exactly: 0 clean, 1 violation, 2 tool error.
CREATE TABLE gate_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  gate       TEXT    NOT NULL,               -- gate4 | gate5
  code       INTEGER NOT NULL,
  hits_json  TEXT,
  ms         INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_gate_runs_user ON gate_runs(user_id, created_at);

-- Every tool call and every admin action. The audit trail is not optional.
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  key_id     INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
  actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT    NOT NULL,
  target     TEXT,
  before_json TEXT,
  after_json  TEXT,
  tool       TEXT,
  status     TEXT    NOT NULL DEFAULT 'ok',
  ms         INTEGER,
  ip         TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_audit_user ON audit_log(user_id, created_at);
CREATE INDEX idx_audit_action ON audit_log(action, created_at);
