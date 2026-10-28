-- Placement: what the operator asked a node to carry, and what happened.
--
-- Before this, placement was never recorded anywhere: the catalogue said what the
-- site offers and each node said what it held, and the difference had to be read
-- by eye. `state` is the answer to "did the request land":
--   pending — asked, the node has not confirmed yet (a 1-2 GB download takes minutes)
--   placed  — the node reported it
--   failed  — refused, unreachable, or not confirmed within 3 hours
CREATE TABLE IF NOT EXISTS placements (
  reciter_id   INTEGER NOT NULL,
  seeder_id    INTEGER NOT NULL,
  state        TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  verified_at  TEXT,
  error        TEXT,
  PRIMARY KEY (reciter_id, seeder_id)
);

-- What a node last reported holding. A cache, not a truth: it is rewritten on
-- every poll, so an offline node keeps its last answer until it answers again.
CREATE TABLE IF NOT EXISTS node_torrents (
  seeder_id  INTEGER NOT NULL,
  infohash   TEXT NOT NULL,
  name       TEXT,
  size       INTEGER,
  done       INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (seeder_id, infohash)
);

CREATE INDEX IF NOT EXISTS node_torrents_infohash ON node_torrents (infohash);
