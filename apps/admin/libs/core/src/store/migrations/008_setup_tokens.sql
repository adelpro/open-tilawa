-- 008_setup_tokens.sql — one-time setup tokens for super-admin bootstrap.
--
-- When a fresh deploy has zero super_admins, the API mints a single-use,
-- short-lived token, prints it to stdout, and stores its hash here. The /setup
-- route consumes it on first success and creates the super_admin account.
-- After that, the table is empty and /setup refuses.

CREATE TABLE setup_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash  TEXT    NOT NULL UNIQUE,   -- sha256(pepper + token)
  expires_at  TEXT    NOT NULL,          -- ISO-8601
  used_at     TEXT,                      -- null until consumed
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
