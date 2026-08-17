-- Minimal generic rate-limiting primitive for unauthenticated write endpoints
-- (admin login brute-force, public channel-submission spam). This is a
-- secondary, defense-in-depth layer — the primary defense should be
-- Cloudflare's account-level Rate Limiting Rules / Bot Fight Mode
-- (dashboard-configured, not something this codebase can set up on its own).

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,   -- e.g. "admin-login:<ip>", "submit-channel:<ip>"
  count        INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);
