-- Per-viewer weighted signal for biasing the Shorts feed order (v1: simple
-- aggregate counters, not a raw event log or ML model — see shared/sync.js-
-- adjacent shared/shortsClassifier.js comment style for the "why not more"
-- reasoning applied the same way here).
CREATE TABLE IF NOT EXISTS shorts_affinity (
  session_key   TEXT NOT NULL,   -- signed-in viewer's users.id, or the anonymous gtv_anon cookie token
  dimension     TEXT NOT NULL CHECK (dimension IN ('category','channel')),
  value         TEXT NOT NULL,   -- category slug OR youtube_channel_id
  score         INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (session_key, dimension, value)
);
CREATE INDEX IF NOT EXISTS idx_shorts_affinity_session ON shorts_affinity(session_key);
