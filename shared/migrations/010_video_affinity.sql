-- Per-viewer weighted signal for regular (non-Shorts) videos — identical
-- shape to shorts_affinity, just a separate table since the two content
-- types have very different engagement patterns and drive different
-- homepage rows (this one drives "Because You Liked", not the Shorts feed).
CREATE TABLE IF NOT EXISTS video_affinity (
  session_key   TEXT NOT NULL,   -- signed-in viewer's users.id, or the anonymous gtv_anon token
  dimension     TEXT NOT NULL CHECK (dimension IN ('category','channel')),
  value         TEXT NOT NULL,   -- category slug OR youtube_channel_id
  score         INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (session_key, dimension, value)
);
CREATE INDEX IF NOT EXISTS idx_video_affinity_session ON video_affinity(session_key);
