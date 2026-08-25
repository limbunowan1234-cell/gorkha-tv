-- Latest-known watch position per (viewer, video), not an event log — same
-- pattern as shorts_affinity/quota_usage. Drives the homepage "Continue
-- Watching" row (functions/api/home/personalized.js) and lets the watch
-- page resume playback where a viewer left off.
CREATE TABLE IF NOT EXISTS watch_progress (
  session_key       TEXT NOT NULL,   -- signed-in viewer's users.id, or the anonymous gtv_anon token
  youtube_video_id  TEXT NOT NULL,
  progress_seconds  INTEGER NOT NULL DEFAULT 0,
  duration_seconds  INTEGER,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (session_key, youtube_video_id)
);
CREATE INDEX IF NOT EXISTS idx_watch_progress_session ON watch_progress(session_key, updated_at DESC);
