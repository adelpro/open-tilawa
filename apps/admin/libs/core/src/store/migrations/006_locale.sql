-- Interface language, stored per account.
--
-- A preference, not an identity: it changes nothing about authorisation and it is
-- deliberately not part of any token. Stored on the row so a second device opens in
-- the language the first one was left in, which `localStorage` alone cannot do.
--
-- The default is 'en' rather than NULL: every read path then has a locale, and the
-- SPA never has to decide what "no preference" means. A CHECK would be the tidier
-- constraint but SQLite cannot add one to an existing table without a rebuild, so
-- the API validates the value ('en' | 'ar') and the column stays TEXT.
ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'en';

-- The admin list groups by activity, and every screen now sorts by locale-blind
-- columns, so no index is added here: two values are not worth an index.
