-- The account's default master step (A3 hybrid, 4b).
--
-- A profile may carry its own master prompt; this is the one simple fallback used
-- only when the resolved profile has no enabled master step. Two columns rather
-- than a JSON blob: the pair is always written and cleared together, and a name
-- without instructions (or the reverse) is refused at the API edge, so the shape
-- cannot drift.
--
-- NULL/NULL is "no account default" and is the state of every existing row: the
-- bundled default chain has no master either, so nothing changes until someone
-- writes one. Text only; prompt material is never executed.
ALTER TABLE users ADD COLUMN master_name TEXT;
ALTER TABLE users ADD COLUMN master_body TEXT;
