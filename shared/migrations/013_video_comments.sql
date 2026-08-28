-- Native GorkhaTV comments (viewer-authored, one level of nesting) — NOT the
-- read-only YouTube-comments mirror (video_comments_cache). Used only by the
-- watch page; Shorts/Feed keep the YouTube mirror.
CREATE TABLE IF NOT EXISTS video_comments (
  id                 TEXT PRIMARY KEY,
  youtube_video_id   TEXT NOT NULL,
  user_id            TEXT NOT NULL,
  parent_comment_id  TEXT,
  body               TEXT NOT NULL,
  author_name        TEXT NOT NULL,
  author_avatar_url  TEXT,
  created_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_video_comments_video ON video_comments(youtube_video_id, parent_comment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_comments_parent ON video_comments(parent_comment_id);
