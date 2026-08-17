-- Fixes channels.youtube_channel_id from NOT NULL to nullable — public
-- "Submit Your Channel" submissions don't have a resolved YouTube channel ID
-- until an admin approves them (see functions/api/creators/submit.js and
-- functions/api/admin/creators/[id]/approve.js). SQLite has no ALTER COLUMN,
-- so this recreates the table, preserving existing rows.

ALTER TABLE channels RENAME TO channels_old_001;

CREATE TABLE channels (
  id                       TEXT PRIMARY KEY,
  youtube_channel_id       TEXT UNIQUE,
  channel_name             TEXT NOT NULL,
  channel_handle           TEXT,
  channel_url              TEXT,
  thumbnail_url            TEXT,
  description               TEXT,
  location                 TEXT,
  category                 TEXT,
  status                   TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected','suspended')),
  verified                 INTEGER NOT NULL DEFAULT 0,
  featured                 INTEGER NOT NULL DEFAULT 0,
  monitoring_enabled       INTEGER NOT NULL DEFAULT 1,
  uploads_playlist_id      TEXT,
  contact_name             TEXT,
  contact_email            TEXT,
  submitted_by_user_id     TEXT,
  last_checked_at          TEXT,
  last_video_published_at  TEXT,
  created_at               TEXT NOT NULL,
  updated_at                TEXT NOT NULL
);

INSERT INTO channels SELECT * FROM channels_old_001;
DROP TABLE channels_old_001;

CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);
CREATE INDEX IF NOT EXISTS idx_channels_monitoring ON channels(monitoring_enabled, last_checked_at);
