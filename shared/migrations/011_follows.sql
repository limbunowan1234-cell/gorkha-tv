CREATE TABLE IF NOT EXISTS follows (
  user_id     TEXT NOT NULL,
  channel_id  TEXT NOT NULL,   -- channels.id (internal), same style as favourites.video_id -> videos.id
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_channel ON follows(channel_id);
