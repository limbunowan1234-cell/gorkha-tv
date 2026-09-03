-- Root-level channel profile slugs (gorkhatv.site/adharlimbu). Nullable —
-- only approved channels ever get one (pending/rejected/suspended channels
-- have no public URL yet). SQLite can't add a UNIQUE column inline via
-- ALTER TABLE, hence the separate unique index.
ALTER TABLE channels ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_slug ON channels(slug);
