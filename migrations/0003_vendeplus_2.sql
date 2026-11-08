CREATE TABLE IF NOT EXISTS marketplace_seller_profiles (
 seller_id TEXT PRIMARY KEY REFERENCES marketplace_sellers(id) ON DELETE CASCADE,
 bio TEXT NOT NULL DEFAULT '' CHECK(length(bio)<=600)
);
CREATE TABLE IF NOT EXISTS marketplace_listing_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
 seller_id TEXT NOT NULL REFERENCES marketplace_sellers(id),
 event TEXT NOT NULL,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE IF NOT EXISTS marketplace_reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id),
 reporter_hash TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(reason IN ('spam','fraud','prohibited','other')),
 details TEXT NOT NULL DEFAULT '' CHECK(length(details)<=500),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 decision TEXT CHECK(decision IN ('dismissed','removed')),
 resolved_by TEXT REFERENCES marketplace_accounts(id),
 resolved_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(listing_id,reporter_hash)
);
CREATE INDEX IF NOT EXISTS marketplace_reports_queue ON marketplace_reports(status,created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_listing_events_time ON marketplace_listing_events(created_at DESC);
