-- Single-use recovery codes for a lost authenticator.
--
-- Ten of these are minted when 2FA is enrolled and shown once. Each is stored
-- peppered and hashed, like a setup token, so a database read does not reveal
-- them. `used_at` makes a code single-use; regenerating a set marks the old
-- unused codes used and mints fresh ones.
--
-- They are weaker than the authenticator (anyone holding a code can sign in) but
-- stronger than "nothing": they are ten separate secrets, each consumed on use,
-- and they are the only self-service path that does not depend on the mailbox.

CREATE TABLE recovery_codes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT    NOT NULL,
  used_at     TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_recovery_codes_user ON recovery_codes(user_id);
