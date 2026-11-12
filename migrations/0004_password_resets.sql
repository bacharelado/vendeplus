CREATE TABLE IF NOT EXISTS marketplace_password_resets(
 token_hash TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
 email TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 used_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT(unixepoch())
);
CREATE INDEX IF NOT EXISTS marketplace_password_resets_account ON marketplace_password_resets(account_id);
CREATE INDEX IF NOT EXISTS marketplace_password_resets_expiry ON marketplace_password_resets(expires_at);
