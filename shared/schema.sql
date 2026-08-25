-- GorkhaTV D1 schema
-- Applied via: npm run d1:migrate:local  (or :remote once the D1 database exists in Cloudflare)

-- ── Channels (approved creators being monitored + pending submissions) ──
CREATE TABLE IF NOT EXISTS channels (
  id                       TEXT PRIMARY KEY,
  youtube_channel_id       TEXT UNIQUE,   -- nullable: unresolved until an admin approves a public submission
  channel_name             TEXT NOT NULL,
  channel_handle           TEXT,
  channel_url              TEXT,
  thumbnail_url            TEXT,
  description               TEXT,
  location                 TEXT,   -- Darjeeling | Kalimpong | Kurseong | Mirik | Siliguri | Other
  category                 TEXT,
  status                   TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected','suspended')),
  verified                 INTEGER NOT NULL DEFAULT 0,
  featured                 INTEGER NOT NULL DEFAULT 0,
  monitoring_enabled       INTEGER NOT NULL DEFAULT 1,
  uploads_playlist_id      TEXT,   -- cached from channels.list, avoids refetching every sync
  contact_name             TEXT,
  contact_email            TEXT,
  submitted_by_user_id     TEXT,   -- FK -> users.id, nullable (public submissions may be anonymous)
  last_checked_at          TEXT,
  last_video_published_at  TEXT,   -- high-water mark for incremental polling
  created_at               TEXT NOT NULL,
  updated_at                TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);
CREATE INDEX IF NOT EXISTS idx_channels_monitoring ON channels(monitoring_enabled, last_checked_at);

-- ── Videos (discovered YouTube metadata only — never a file, never hosted here) ──
CREATE TABLE IF NOT EXISTS videos (
  id                    TEXT PRIMARY KEY,
  youtube_video_id      TEXT UNIQUE NOT NULL,
  youtube_channel_id    TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  thumbnail_url         TEXT,
  channel_name          TEXT,   -- denormalized snapshot at discovery time
  channel_handle        TEXT,
  published_at          TEXT NOT NULL,
  category               TEXT,
  location                TEXT,
  tags                    TEXT,   -- JSON array string
  duration_seconds         INTEGER,
  view_count               INTEGER DEFAULT 0,   -- YouTube's public stat, refreshed on poll
  like_count                INTEGER,
  relevance_score           INTEGER,   -- 0-100, deterministic scorer output (shared/relevance.js)
  status                   TEXT NOT NULL DEFAULT 'pending_review'
                              CHECK (status IN ('published','pending_review','rejected','removed')),
  featured                 INTEGER DEFAULT 0,
  trending                  INTEGER DEFAULT 0,
  source                   TEXT CHECK (source IN ('channel_poll','keyword_search','manual')),
  ai_confidence_score        REAL,   -- reserved, unused in v1 (future AI classification step)
  ai_labels                  TEXT,   -- reserved, unused in v1 (JSON)
  content_type               TEXT CHECK (content_type IN ('short','video')),   -- classified via YouTube's own /shorts/ redirect signal, see shared/migrations/005
  discovered_at              TEXT,
  approved_at                 TEXT,
  created_at                TEXT NOT NULL,
  updated_at                 TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_videos_status_published ON videos(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category ON videos(category);
CREATE INDEX IF NOT EXISTS idx_videos_location ON videos(location);
CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(youtube_channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_featured ON videos(featured);
CREATE INDEX IF NOT EXISTS idx_videos_trending ON videos(trending);
CREATE INDEX IF NOT EXISTS idx_videos_content_type ON videos(content_type, published_at DESC);

-- ── Categories ──
CREATE TABLE IF NOT EXISTS categories (
  slug        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1
);

INSERT OR IGNORE INTO categories (slug, label, sort_order) VALUES
  ('news',          'News',          1),
  ('vlogs',         'Vlogs',         2),
  ('travel',        'Travel',        3),
  ('food',          'Food',          4),
  ('culture',       'Culture',       5),
  ('music',         'Music',         6),
  ('interviews',    'Interviews',    7),
  ('entertainment', 'Entertainment', 8),
  ('sports',        'Sports',        9),
  ('events',        'Events',        10);

-- ── Viewers (Google-authenticated, via Google Identity Services id_token verification) ──
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  google_sub     TEXT UNIQUE NOT NULL,
  email          TEXT,
  name           TEXT,
  avatar_url     TEXT,
  display_name   TEXT,   -- viewer-set override of Google's `name`; NULL = use Google's
  bio            TEXT,
  created_at     TEXT NOT NULL,
  last_login_at  TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS favourites (
  user_id     TEXT NOT NULL,
  video_id    TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, video_id)
);

-- Lets a signed-in viewer request ownership of a channel that already exists
-- on the platform but has no owner (e.g. one an admin added directly).
-- Approval is always a manual admin decision, never automatic.
CREATE TABLE IF NOT EXISTS channel_claims (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at  TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_channel_claims_status ON channel_claims(status);
CREATE INDEX IF NOT EXISTS idx_channel_claims_channel ON channel_claims(channel_id);

-- ── Sync observability ──
CREATE TABLE IF NOT EXISTS sync_runs (
  id                     TEXT PRIMARY KEY,
  run_type               TEXT CHECK (run_type IN ('channel_poll','keyword_search','manual')),
  started_at             TEXT NOT NULL,
  finished_at            TEXT,
  channels_checked       INTEGER DEFAULT 0,
  videos_found           INTEGER DEFAULT 0,
  videos_published       INTEGER DEFAULT 0,
  videos_queued_review   INTEGER DEFAULT 0,
  videos_rejected        INTEGER DEFAULT 0,
  quota_units_used       INTEGER DEFAULT 0,
  status                 TEXT CHECK (status IN ('success','partial','failed')),
  error_message          TEXT
);

CREATE TABLE IF NOT EXISTS sync_errors (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL,
  entity_type    TEXT,   -- channel | video | search_query
  entity_id      TEXT,
  error_message  TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_errors_run ON sync_errors(run_id);

-- Self-enforced daily quota budget (one row per UTC date)
CREATE TABLE IF NOT EXISTS quota_usage (
  date               TEXT PRIMARY KEY,   -- YYYY-MM-DD
  units_used         INTEGER DEFAULT 0,
  search_calls_used  INTEGER DEFAULT 0
);

-- Per-viewer weighted signal for biasing the Shorts feed order (v1: simple
-- aggregate counters, not a raw event log or ML model).
CREATE TABLE IF NOT EXISTS shorts_affinity (
  session_key   TEXT NOT NULL,   -- signed-in viewer's users.id, or the anonymous gtv_anon cookie token
  dimension     TEXT NOT NULL CHECK (dimension IN ('category','channel')),
  value         TEXT NOT NULL,   -- category slug OR youtube_channel_id
  score         INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (session_key, dimension, value)
);
CREATE INDEX IF NOT EXISTS idx_shorts_affinity_session ON shorts_affinity(session_key);

-- Read-only cache of a video's real YouTube comments — one row per video,
-- storing the whole fetched batch as JSON rather than a per-comment table,
-- since it's always read/replaced as one unit.
CREATE TABLE IF NOT EXISTS video_comments_cache (
  youtube_video_id TEXT PRIMARY KEY,
  comments_json     TEXT,   -- JSON array of {author, authorAvatar, text, likeCount, publishedAt}
  status             TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'disabled')),
  fetched_at         TEXT NOT NULL
);

-- Minimal generic rate limiter for unauthenticated write endpoints
-- (admin login attempts, public channel submissions) — secondary
-- defense-in-depth alongside Cloudflare's own edge-level protections.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);
