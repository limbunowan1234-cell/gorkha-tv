-- Cover/banner image for creator profile pages — fetched from YouTube's
-- channels.list brandingSettings.image.bannerExternalUrl, same source as
-- thumbnail_url. Nullable — not every channel has one set.
ALTER TABLE channels ADD COLUMN banner_url TEXT;
