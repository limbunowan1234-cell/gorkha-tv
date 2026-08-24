-- Distinguishes YouTube Shorts (vertical, <=3min, YouTube's own /shorts/ classification)
-- from regular landscape videos, so the Shorts feed never mixes with browse rows.
ALTER TABLE videos ADD COLUMN content_type TEXT CHECK (content_type IN ('short','video'));
CREATE INDEX IF NOT EXISTS idx_videos_content_type ON videos(content_type, published_at DESC);
