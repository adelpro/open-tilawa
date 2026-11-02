-- How old the devices that opened the app are, in ranges.
--
-- `device_days` (022) counts devices. This table counts the same devices by an
-- age range the client computes locally from its own first-open date: "new",
-- "1-3", "4-6", "7-13", "14-29", "30+". The date itself never leaves the browser
-- and no column here identifies a device, so the server can say "four of today's
-- seven devices first opened the app a week ago or more" without being able to
-- say which four — the same floor as `device_days`, one dimension deeper.
--
-- A device that reported before the age shipped has no row here. The console
-- reads that as "not reported", never as "new".
CREATE TABLE IF NOT EXISTS device_ages (
  day     TEXT    NOT NULL,
  age     TEXT    NOT NULL,
  devices INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, age)
);
