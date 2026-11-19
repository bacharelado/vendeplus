ALTER TABLE marketplace_sellers ADD COLUMN verified_whatsapp TEXT;
ALTER TABLE marketplace_sellers ADD COLUMN contact_code TEXT;
ALTER TABLE marketplace_sellers ADD COLUMN profile_contact INTEGER NOT NULL DEFAULT 0 CHECK(profile_contact IN (0,1));
ALTER TABLE marketplace_seller_reports ADD COLUMN decision TEXT CHECK(decision IN ('dismissed','suspended'));
ALTER TABLE marketplace_seller_reports ADD COLUMN resolved_by TEXT REFERENCES marketplace_accounts(id);
ALTER TABLE marketplace_seller_reports ADD COLUMN resolved_at INTEGER;
ALTER TABLE marketplace_listings ADD COLUMN photo_request_id TEXT;

CREATE TABLE IF NOT EXISTS marketplace_report_salts (
 day INTEGER PRIMARY KEY,
 salt TEXT NOT NULL
);
