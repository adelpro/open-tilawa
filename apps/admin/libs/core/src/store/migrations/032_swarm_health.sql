-- What the swarm looks like for one reciter, sampled by the hour.
--
-- The tracker is the only place that sees every peer: the seeders screen knows
-- which of our nodes hold a release, and nothing knows whether a listener can
-- actually get it. `/scrape` answers that per infohash, and this is the last
-- answer per release — no history, because the question a volunteer asks is
-- "does this one need me now", and a column of yesterday's numbers is not an
-- answer to it.
--
-- `seeders` is the tracker's `complete` count: peers announcing that they have
-- the whole release. Zero means nobody serves this recitation right now, which is
-- the state a volunteer can fix. `leechers` rides along because the same scrape
-- returns it and a row with demand and no supply is worth seeing.
CREATE TABLE IF NOT EXISTS swarm_health (
  infohash   TEXT PRIMARY KEY,
  seeders    INTEGER NOT NULL DEFAULT 0,
  leechers   INTEGER NOT NULL DEFAULT 0,
  sampled_at TEXT NOT NULL
);
