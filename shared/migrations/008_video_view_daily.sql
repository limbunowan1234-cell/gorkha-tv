-- Real on-site view tracking, day-bucketed (not a raw event log) so it never
-- grows unbounded while still supporting a "recent activity" window — same
-- pattern as quota_usage. Drives the homepage Trending row (see
-- functions/api/home.js), which is now computed from actual GorkhaTV
-- engagement (this + favourites) rather than YouTube's own public stats or
-- an admin-curated flag.
CREATE TABLE IF NOT EXISTS video_view_daily (
  youtube_video_id TEXT NOT NULL,
  view_date        TEXT NOT NULL,   -- YYYY-MM-DD (UTC)
  view_count       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (youtube_video_id, view_date)
);
CREATE INDEX IF NOT EXISTS idx_video_view_daily_date ON video_view_daily(view_date);
