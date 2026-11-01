-- 024_user_identities.sql — provider identities, restored.
--
-- The table existed as 005_oauth.sql and was dropped by 016 when the fork-only
-- OAuth code was removed. Social sign-in returns, so the table does too; the
-- constraints are the original ones because they encode the rules, not taste.
--
-- One row per (provider, subject): the subject is the provider's own stable id
-- for the human, never the email, because an email can change at the provider
-- and a changed address must not orphan the link or, worse, point it at
-- someone else.
--
-- `email` is the address the provider asserted at link time. It is evidence,
-- not a key: nothing joins on it.
--
-- No `password_set` column. The presence of `users.password_hash` is the same
-- fact already, and a second column can disagree with the hash it describes. An
-- OAuth account simply has no hash, and that is what "this account signs in
-- with a provider" means.

CREATE TABLE user_identities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   TEXT    NOT NULL CHECK (provider IN ('google','github')),
  subject    TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

  -- One provider identity belongs to exactly one account...
  UNIQUE (provider, subject),
  -- ...and an account carries at most one identity per provider. Two Google
  -- identities on one account would make "which one signs in" a question with
  -- no answer, and unlinking ambiguous.
  UNIQUE (user_id, provider)
);

CREATE INDEX idx_user_identities_user ON user_identities(user_id);
