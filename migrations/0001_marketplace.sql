PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS marketplace_sellers(
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 2 AND 80),
  whatsapp TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','suspended')),
  created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE TABLE IF NOT EXISTS marketplace_listings(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id TEXT NOT NULL REFERENCES marketplace_sellers(id),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 5 AND 90),
  description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 10 AND 2000),
  price_cents INTEGER CHECK(price_cents IS NULL OR(typeof(price_cents)='integer' AND price_cents>0 AND price_cents<=100000000)),
  category TEXT NOT NULL CHECK(category IN('Alimentação','Moda','Eletrônicos','Casa','Beleza','Serviços')),
  condition TEXT NOT NULL CHECK(condition IN('Novo','Usado','Não aplicável')),
  fulfillment TEXT NOT NULL CHECK(length(trim(fulfillment)) BETWEEN 1 AND 180),
  image_url TEXT CHECK(image_url IS NULL OR image_url LIKE 'https://%'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','published','paused','sold','rejected','removed')),
  created_at INTEGER NOT NULL DEFAULT(unixepoch()),
  CHECK(price_cents IS NOT NULL OR category='Serviços')
);
CREATE INDEX IF NOT EXISTS marketplace_listing_catalog ON marketplace_listings(status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS marketplace_listing_seller ON marketplace_listings(seller_id,status);
