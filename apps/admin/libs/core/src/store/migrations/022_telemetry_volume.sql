-- Volume: what serving the corpus costs, and how many devices are listening.
--
-- Two tables and two grains, because the two sources cannot be added together
-- honestly. `media_daily` is bytes our own nginx sent from `/media`, read from
-- its access log: exact, per surah, and independent of consent. `torrent_daily`
-- is bytes the seeder fleet uploaded to peers, sampled from each node's
-- cumulative counter: approximate, and only per reciter, because a torrent is a
-- reciter's corpus rather than one surah.
--
-- Neither table has a column for a person. A byte count is not an identity.

-- Keyed by the folder the request named, not by a slug: the path is what nginx
-- logged, and a slug is derived from the torrent's folder name by a function the
-- importer has no business running. The console joins the two at read time
-- (`node_torrents.name` → `reciters.slug`), so a line written before the node was
-- first polled still counts once the mapping exists.
CREATE TABLE IF NOT EXISTS media_daily (
  day     TEXT    NOT NULL,
  folder  TEXT    NOT NULL,
  surah   INTEGER NOT NULL,
  bytes   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, folder, surah)
);

-- The console always asks for a window, so the day is the only useful key.
CREATE INDEX IF NOT EXISTS media_daily_day ON media_daily (day);

CREATE TABLE IF NOT EXISTS torrent_daily (
  day     TEXT    NOT NULL,
  reciter TEXT    NOT NULL,
  bytes   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, reciter)
);

CREATE INDEX IF NOT EXISTS torrent_daily_day ON torrent_daily (day);

-- One row per day, incremented in place. The raw "a device was here" rows are
-- never stored: a device reports at most once a day and carries no identifier,
-- so the server cannot join two days even if it wanted to. That is why this
-- counts devices, never people, and why the screen reads it as a floor.
CREATE TABLE IF NOT EXISTS device_days (
  day     TEXT    PRIMARY KEY,
  devices INTEGER NOT NULL DEFAULT 0
);
