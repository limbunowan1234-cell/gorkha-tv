-- Read-only cache of a video's real YouTube comments — one row per video,
-- storing the whole fetched batch as JSON rather than a per-comment table,
-- since it's always read/replaced as one unit (see functions/api/videos/[id]/comments.js).
-- status distinguishes "no comments fetched yet"/"has comments"/"comments
-- disabled by uploader" so a disabled video isn't re-fetched every request.
CREATE TABLE IF NOT EXISTS video_comments_cache (
  youtube_video_id TEXT PRIMARY KEY,
  comments_json     TEXT,   -- JSON array of {author, authorAvatar, text, likeCount, publishedAt}
  status             TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'disabled')),
  fetched_at         TEXT NOT NULL
);
