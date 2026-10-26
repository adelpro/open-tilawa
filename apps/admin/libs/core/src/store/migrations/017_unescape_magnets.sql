-- URLSearchParams.toString() percent-encoded ':' and '/' inside magnet values, and
-- magnet-uri/parse-torrent do not percent-decode: every catalogue magnet was
-- rejected by the player as "Invalid torrent identifier". Restore the literal
-- characters the parsers expect. Both are legal in a query value (RFC 3986), so
-- this is the canonical form, not a workaround.
UPDATE reciters
SET magnet = REPLACE(REPLACE(REPLACE(REPLACE(magnet, '%3A', ':'), '%3a', ':'), '%2F', '/'), '%2f', '/');
