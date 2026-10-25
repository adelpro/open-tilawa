-- 013_owner.sql — one Owner per instance, and the claim backfill.
-- Forward-only. Never edit an applied migration; add a new file.

ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0
  CHECK (is_owner IN (0, 1));

-- The hard guarantee: a second owner is impossible, whatever the service does.
CREATE UNIQUE INDEX one_owner ON users(is_owner) WHERE is_owner = 1;

-- Existing installs: the oldest active super_admin becomes the Owner. The CLI
-- (`yarn admin owner:set`) is the break-glass path if this chose the wrong row.
UPDATE users
SET is_owner = 1
WHERE id = (
  SELECT id FROM users
  WHERE role = 'super_admin' AND status = 'active'
  ORDER BY created_at ASC, id ASC
  LIMIT 1
);
