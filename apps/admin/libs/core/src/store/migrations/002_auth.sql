-- 002_auth.sql — server-side sessions, device trust and invites.
--
-- Sessions are looked up by sha256(token), NOT by an argon2 hash: argon2 is
-- salted per hash, so the same token hashes differently every time and a
-- lookup could never match. The ported code used argon2 with one salt per
-- process, which made lookups work in-process and invalidate every session on
-- restart — an accidental dependency on a bug. Deterministic, fast hashing is
-- the correct primitive here; argon2 stays where it belongs, on passwords.

CREATE TABLE sessions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash       TEXT    NOT NULL UNIQUE,  -- sha256(token)
  fingerprint_hash TEXT,                     -- sha256(canonical JSON of the fingerprint)
  fingerprint_json TEXT,
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at       TEXT    NOT NULL,
  last_seen_at     TEXT
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE UNIQUE INDEX idx_sessions_device ON sessions(user_id, fingerprint_hash);

-- A fingerprint that passed 2FA. Absent means "challenge this device".
CREATE TABLE trusted_devices (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint_hash TEXT    NOT NULL,
  fingerprint_json TEXT    NOT NULL,
  added_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at       TEXT,                      -- 90 days, mirroring the ported schema
  UNIQUE (user_id, fingerprint_hash)
);

-- Invite codes, for closed registration. Stores only the code hash.
CREATE TABLE invites (
  code_hash  TEXT    PRIMARY KEY,
  email      TEXT,
  role       TEXT    NOT NULL DEFAULT 'user',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT,
  used_at    TEXT
);
