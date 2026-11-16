-- Aplicar primeiro na base de prévia; promover em produção antes de publicar a nova versão.
ALTER TABLE marketplace_listings ADD COLUMN video_id TEXT
 CHECK(video_id IS NULL OR (length(video_id)=11 AND video_id NOT GLOB '*[^A-Za-z0-9_-]*'));
