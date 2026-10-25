-- 009_temp_links.sql — single-use, purpose-bound email links (activation/reset).
--
-- Before this table an activation or reset link was just a bearer JWT: valid
-- for its whole TTL, redeemable as many times as it was presented, and
-- interchangeable between the two flows because both mails signed the same
-- claim shape. One forwarded email was a 15-minute reusable credential.
--
-- Now every issued link gets a random jti, a purpose and a row here:
--   issuance   → one INSERT with consumed_at NULL
--   redemption → an atomic UPDATE flipping consumed_at (changes = 1 only once)
--   replay     → the same jti hits a consumed row and is refused
--   password change / activation landing → the account's UNCONSUMED rows of
--   that flow are deleted, so every other outstanding link dies instantly.
-- Expired rows are pruned opportunisticly whenever a new link is issued; they
-- are worthless once past expires_at (expiry is checked on redemption too).

CREATE TABLE temp_links (
  jti         TEXT    PRIMARY KEY,      -- random token identity inside the JWT
  user_id     INTEGER NOT NULL,
  purpose     TEXT    NOT NULL,         -- 'activation' | 'reset'
  expires_at  TEXT    NOT NULL,         -- ISO-8601
  consumed_at TEXT,                      -- null until the link is redeemed once
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_temp_links_user ON temp_links(user_id, purpose, consumed_at);
