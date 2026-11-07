CREATE TABLE IF NOT EXISTS marketplace_accounts (
 id TEXT PRIMARY KEY REFERENCES marketplace_sellers(id),
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 neighborhood TEXT NOT NULL CHECK(neighborhood IN ('Poranga I','Poranga II','Jacarezinho')),
 role TEXT NOT NULL DEFAULT 'seller' CHECK(role IN ('seller','admin')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE IF NOT EXISTS marketplace_sessions (
 token_hash TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS marketplace_session_account ON marketplace_sessions(account_id);
CREATE TABLE IF NOT EXISTS marketplace_rate_limits (
 key TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS marketplace_listing_details (
 listing_id INTEGER PRIMARY KEY REFERENCES marketplace_listings(id) ON DELETE CASCADE,
 neighborhood TEXT NOT NULL CHECK(neighborhood IN ('Poranga I','Poranga II','Jacarezinho')),
 request_id TEXT NOT NULL,
 seller_id TEXT NOT NULL REFERENCES marketplace_sellers(id),
 UNIQUE(seller_id,request_id)
);
CREATE TABLE IF NOT EXISTS marketplace_moderation_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 admin_id TEXT NOT NULL REFERENCES marketplace_accounts(id),
 listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id),
 action TEXT NOT NULL CHECK(action IN ('published','rejected')),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE IF NOT EXISTS marketplace_seller_reviews (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 admin_id TEXT NOT NULL REFERENCES marketplace_accounts(id),
 seller_id TEXT NOT NULL REFERENCES marketplace_sellers(id),
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
