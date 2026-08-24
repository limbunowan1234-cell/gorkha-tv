-- Lets a signed-in viewer request ownership of a channel that's already on
-- the platform but has no owner attached (e.g. one an admin added directly).
-- Approval is always a manual admin decision — never automatic.
CREATE TABLE IF NOT EXISTS channel_claims (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL,   -- FK -> channels.id
  user_id     TEXT NOT NULL,   -- FK -> users.id (the claimant)
  message     TEXT,            -- optional note/proof from the claimant
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at  TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_channel_claims_status ON channel_claims(status);
CREATE INDEX IF NOT EXISTS idx_channel_claims_channel ON channel_claims(channel_id);
