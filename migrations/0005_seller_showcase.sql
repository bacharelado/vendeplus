ALTER TABLE marketplace_seller_profiles ADD COLUMN slug TEXT;
ALTER TABLE marketplace_seller_profiles ADD COLUMN seller_type TEXT NOT NULL DEFAULT 'person' CHECK(seller_type IN ('person','business'));
ALTER TABLE marketplace_seller_profiles ADD COLUMN business_name TEXT NOT NULL DEFAULT '' CHECK(length(business_name)<=80);
ALTER TABLE marketplace_seller_profiles ADD COLUMN avatar_url TEXT CHECK(avatar_url IS NULL OR avatar_url LIKE 'https://%');
ALTER TABLE marketplace_seller_profiles ADD COLUMN cover_url TEXT CHECK(cover_url IS NULL OR cover_url LIKE 'https://%');

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_seller_profiles_slug
ON marketplace_seller_profiles(slug COLLATE NOCASE)
WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS marketplace_seller_reports (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 seller_id TEXT NOT NULL REFERENCES marketplace_sellers(id),
 reporter_hash TEXT NOT NULL,
 reason TEXT NOT NULL CHECK(reason IN ('spam','fraud','impersonation','prohibited','other')),
 details TEXT NOT NULL DEFAULT '' CHECK(length(details)<=500),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch()),
 UNIQUE(seller_id,reporter_hash)
);
CREATE INDEX IF NOT EXISTS marketplace_seller_reports_queue ON marketplace_seller_reports(status,created_at DESC);
