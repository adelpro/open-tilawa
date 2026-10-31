-- The launch funnel: how many devices opened the app, and how many of them
-- actually started playing.
--
-- `device_days` (022) already answers the first half. This table answers the
-- second, on the same terms: one row per day, incremented in place, and no
-- column for a device. `first_play` carries only a version and a locale, so the
-- server counts devices that played without being able to say which — the same
-- floor, one step further down the funnel.
--
-- Two counters and not one event table: a raw row lives 90 days, and "how many
-- devices ever played" has to outlive that window.
CREATE TABLE IF NOT EXISTS listener_days (
  day       TEXT    PRIMARY KEY,
  listeners INTEGER NOT NULL DEFAULT 0
);
