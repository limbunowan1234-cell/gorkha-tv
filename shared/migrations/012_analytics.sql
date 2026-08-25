-- Day-bucketed "a session was active" record for arbitrary page views (not
-- just video-watch actions) — powers DAU/MAU. Same shape/spirit as
-- video_view_daily.
CREATE TABLE IF NOT EXISTS session_activity_daily (
  session_key   TEXT NOT NULL,
  activity_date TEXT NOT NULL,   -- YYYY-MM-DD (UTC)
  page_views    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_key, activity_date)
);
CREATE INDEX IF NOT EXISTS idx_session_activity_date ON session_activity_daily(activity_date);

-- One row per session_key ever seen, recording only the date it was first
-- seen. Lets "new vs returning" be computed without scanning the full
-- (unbounded, growing) activity history.
CREATE TABLE IF NOT EXISTS session_first_seen (
  session_key     TEXT PRIMARY KEY,
  first_seen_date TEXT NOT NULL
);

-- Approximate accumulated watch time, day-bucketed. Built from clamped
-- deltas between successive progress-sync pings (see functions/api/videos/
-- [id]/progress.js) rather than a raw event log.
CREATE TABLE IF NOT EXISTS watch_time_daily (
  session_key      TEXT NOT NULL,
  watch_date       TEXT NOT NULL,   -- YYYY-MM-DD (UTC)
  seconds_watched  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_key, watch_date)
);
CREATE INDEX IF NOT EXISTS idx_watch_time_date ON watch_time_daily(watch_date);
