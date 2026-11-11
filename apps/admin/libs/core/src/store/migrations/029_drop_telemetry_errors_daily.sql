-- Drop the second rollup.
--
-- `telemetry_errors_daily` grouped errors by version and code on the same hourly beat as
-- `telemetry_daily`. Nothing ever read it: the errors panel groups by version, which
-- `telemetry_daily` now carries, and the recent-errors list reads the raw rows. The one
-- thing it held alone was the error-code breakdown, and no screen asks for that.
--
-- Two rollups that have to agree are one rollup too many, and a table written every hour
-- with no reader is a promise nobody keeps. The hourly job loses one INSERT here.

DROP TABLE IF EXISTS telemetry_errors_daily;
