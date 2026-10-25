-- Emailed one-time codes, for the account whose authenticator is gone.
--
-- A separate table rather than `temp_links`: that ledger carries a signed JWT and
-- a `jti`, which is the wrong shape for six digits. A code is stored peppered and
-- hashed like a setup token, is single-use, and carries its own attempt counter —
-- the counter is what stops a guesser, because the HTTP throttle is bypassed in
-- the test environment and therefore cannot be the guarantee.
--
-- The send budget is derived from these rows (`created_at`, per user, per window)
-- rather than an in-memory map: a restart must not reset it, and a test has to be
-- able to prove it. Rows are consumed, never deleted, so the budget stays honest.

CREATE TABLE email_otp (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT    NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT    NOT NULL,
  consumed_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_email_otp_user ON email_otp(user_id, created_at);
