// D1 access helpers. Every function takes a D1Database handle (`db`) as its
// first argument instead of importing a global — keeps this module usable from
// Pages Functions, the standalone sync Worker, and any future backend that
// hands us a D1-compatible binding.

import { randomToken, parseCookies, buildSetCookie } from './auth.js';
import { VIEWER_SESSION_COOKIE, ANON_SESSION_COOKIE, ANON_SESSION_TTL_SECONDS, RESERVED_ROOT_SLUGS } from './constants.js';

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

// ── Channels ──

export async function getChannelsDueForPoll(db, limit) {
  const { results } = await db
    .prepare(
      `SELECT * FROM channels
       WHERE status = 'approved' AND monitoring_enabled = 1
       ORDER BY last_checked_at IS NOT NULL, last_checked_at ASC
       LIMIT ?`
    )
    .bind(limit)
    .all();
  return results;
}

export async function getChannelById(db, id) {
  return db.prepare(`SELECT * FROM channels WHERE id = ?`).bind(id).first();
}

export async function getChannelByYoutubeId(db, youtubeChannelId) {
  return db.prepare(`SELECT * FROM channels WHERE youtube_channel_id = ?`).bind(youtubeChannelId).first();
}

export async function insertChannelSubmission(db, submission) {
  const id = newId();
  const ts = nowIso();
  await db
    .prepare(
      `INSERT INTO channels
        (id, youtube_channel_id, channel_name, channel_handle, channel_url, thumbnail_url,
         description, location, category, status, verified, featured, monitoring_enabled,
         contact_name, contact_email, submitted_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, 0, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      submission.youtubeChannelId || null,
      submission.channelName,
      submission.channelHandle || null,
      submission.channelUrl || null,
      submission.thumbnailUrl || null,
      submission.description || null,
      submission.location || null,
      submission.category || null,
      submission.contactName || null,
      submission.contactEmail || null,
      submission.submittedByUserId || null,
      ts,
      ts
    )
    .run();
  return id;
}

export async function updateChannelStatus(db, id, status, extra = {}) {
  const fields = ['status = ?', 'updated_at = ?'];
  const values = [status, nowIso()];
  if ('monitoringEnabled' in extra) {
    fields.push('monitoring_enabled = ?');
    values.push(extra.monitoringEnabled ? 1 : 0);
  }
  if ('uploadsPlaylistId' in extra) {
    fields.push('uploads_playlist_id = ?');
    values.push(extra.uploadsPlaylistId);
  }
  if ('youtubeChannelId' in extra) {
    fields.push('youtube_channel_id = ?');
    values.push(extra.youtubeChannelId);
  }
  if ('thumbnailUrl' in extra) {
    fields.push('thumbnail_url = ?');
    values.push(extra.thumbnailUrl);
  }
  if ('slug' in extra) {
    fields.push('slug = ?');
    values.push(extra.slug);
  }
  values.push(id);
  await db.prepare(`UPDATE channels SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

// Lowercase, [a-z0-9] only, everything else stripped entirely (not
// hyphenated) — "Adhar Limbu" -> "adharlimbu", "Mr darjeeling -" ->
// "mrdarjeeling", matching the exact style requested for root-level channel
// profile URLs (gorkhatv.site/:slug).
export function slugify(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Generates a slug for a channel that's about to become approved and doesn't
// have one yet, guaranteed unique and never a reserved top-level path (see
// RESERVED_ROOT_SLUGS / functions/[slug].js). Falls back to a short
// id-derived slug if the channel name has no Latin/digit characters at all
// (slugify() would otherwise return ''), and appends -2, -3, ... on collision
// with another channel's slug.
export async function assignUniqueChannelSlug(db, channelName, fallbackId) {
  const base = slugify(channelName) || `channel${(fallbackId || '').replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()}`;

  let candidate = base;
  let suffix = 2;
  for (;;) {
    if (!RESERVED_ROOT_SLUGS.has(candidate)) {
      const existing = await db.prepare(`SELECT 1 FROM channels WHERE slug = ?`).bind(candidate).first();
      if (!existing) return candidate;
    }
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
}

const CHANNEL_EDITABLE_FIELDS = {
  location: 'location',
  category: 'category',
  featured: 'featured',
  verified: 'verified',
  contactName: 'contact_name',
  contactEmail: 'contact_email',
};

export async function updateChannelFields(db, id, fields) {
  const setClauses = ['updated_at = ?'];
  const values = [nowIso()];
  for (const [key, column] of Object.entries(CHANNEL_EDITABLE_FIELDS)) {
    if (key in fields) {
      setClauses.push(`${column} = ?`);
      const v = fields[key];
      values.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
  }
  if (setClauses.length === 1) return; // nothing to update
  values.push(id);
  await db.prepare(`UPDATE channels SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run();
}

export async function setChannelUploadsPlaylistId(db, id, uploadsPlaylistId) {
  await db
    .prepare(`UPDATE channels SET uploads_playlist_id = ?, updated_at = ? WHERE id = ?`)
    .bind(uploadsPlaylistId, nowIso(), id)
    .run();
}

export async function markChannelChecked(db, id, lastVideoPublishedAt) {
  const fields = ['last_checked_at = ?', 'updated_at = ?'];
  const values = [nowIso(), nowIso()];
  if (lastVideoPublishedAt) {
    fields.push('last_video_published_at = ?');
    values.push(lastVideoPublishedAt);
  }
  values.push(id);
  await db.prepare(`UPDATE channels SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

// ── Videos ──

export async function videoExists(db, youtubeVideoId) {
  const row = await db.prepare(`SELECT id FROM videos WHERE youtube_video_id = ?`).bind(youtubeVideoId).first();
  return !!row;
}

export async function insertVideo(db, video) {
  const id = newId();
  const ts = nowIso();
  await db
    .prepare(
      `INSERT OR IGNORE INTO videos
        (id, youtube_video_id, youtube_channel_id, title, description, thumbnail_url,
         channel_name, channel_handle, published_at, category, location, tags,
         duration_seconds, view_count, like_count, relevance_score, status, featured,
         trending, source, content_type, discovered_at, approved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      video.youtubeVideoId,
      video.youtubeChannelId,
      video.title,
      video.description || null,
      video.thumbnailUrl || null,
      video.channelName || null,
      video.channelHandle || null,
      video.publishedAt,
      video.category || null,
      video.location || null,
      JSON.stringify(video.tags || []),
      video.durationSeconds ?? null,
      video.viewCount ?? 0,
      video.likeCount ?? null,
      video.relevanceScore ?? null,
      video.status,
      video.source,
      video.contentType || null,
      ts,
      video.status === 'published' ? ts : null,
      ts,
      ts
    )
    .run();
  return id;
}

export async function updateVideoStatus(db, id, status, extra = {}) {
  const fields = ['status = ?', 'updated_at = ?'];
  const values = [status, nowIso()];
  if (status === 'published') {
    fields.push('approved_at = ?');
    values.push(nowIso());
  }
  for (const key of ['featured', 'trending']) {
    if (key in extra) {
      fields.push(`${key} = ?`);
      values.push(extra[key] ? 1 : 0);
    }
  }
  if ('category' in extra) {
    fields.push('category = ?');
    values.push(extra.category);
  }
  if ('location' in extra) {
    fields.push('location = ?');
    values.push(extra.location);
  }
  if ('contentType' in extra) {
    fields.push('content_type = ?');
    values.push(extra.contentType);
  }
  values.push(id);
  await db.prepare(`UPDATE videos SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
}

// ── Sync observability ──

export async function startSyncRun(db, runType) {
  const id = newId();
  await db
    .prepare(`INSERT INTO sync_runs (id, run_type, started_at, status) VALUES (?, ?, ?, 'partial')`)
    .bind(id, runType, nowIso())
    .run();
  return id;
}

export async function finishSyncRun(db, id, stats) {
  await db
    .prepare(
      `UPDATE sync_runs SET finished_at = ?, channels_checked = ?, videos_found = ?,
        videos_published = ?, videos_queued_review = ?, videos_rejected = ?,
        quota_units_used = ?, status = ?, error_message = ?
       WHERE id = ?`
    )
    .bind(
      nowIso(),
      stats.channelsChecked || 0,
      stats.videosFound || 0,
      stats.videosPublished || 0,
      stats.videosQueuedReview || 0,
      stats.videosRejected || 0,
      stats.quotaUnitsUsed || 0,
      stats.status || 'success',
      stats.errorMessage || null,
      id
    )
    .run();
}

export async function recordSyncError(db, runId, entityType, entityId, errorMessage) {
  await db
    .prepare(
      `INSERT INTO sync_errors (id, run_id, entity_type, entity_id, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(newId(), runId, entityType, entityId, String(errorMessage).slice(0, 2000), nowIso())
    .run();
}

// ── Quota tracking ──

export function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export async function getTodayQuotaUsage(db) {
  const row = await db.prepare(`SELECT * FROM quota_usage WHERE date = ?`).bind(todayKey()).first();
  return row || { date: todayKey(), units_used: 0, search_calls_used: 0 };
}

// ── Viewers (Google-authenticated) ──

export async function upsertUserByGoogleSub(db, { googleSub, email, name, avatarUrl }) {
  const ts = nowIso();
  const existing = await db.prepare(`SELECT id FROM users WHERE google_sub = ?`).bind(googleSub).first();

  if (existing) {
    await db
      .prepare(`UPDATE users SET email = ?, name = ?, avatar_url = ?, last_login_at = ? WHERE id = ?`)
      .bind(email || null, name || null, avatarUrl || null, ts, existing.id)
      .run();
    return existing.id;
  }

  const id = newId();
  await db
    .prepare(`INSERT INTO users (id, google_sub, email, name, avatar_url, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, googleSub, email || null, name || null, avatarUrl || null, ts, ts)
    .run();
  return id;
}

export async function createSession(db, userId, ttlSeconds) {
  const sessionId = randomToken();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db.prepare(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).bind(sessionId, userId, expiresAt, nowIso()).run();
  return { sessionId, expiresAt };
}

export async function getSessionUser(db, sessionId) {
  if (!sessionId) return null;
  return db
    .prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?`)
    .bind(sessionId, nowIso())
    .first();
}

export async function deleteSession(db, sessionId) {
  if (!sessionId) return;
  await db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
}

// display_name/bio are viewer-set and intentionally untouched by
// upsertUserByGoogleSub — only this function writes them.
export async function updateUserProfile(db, userId, { displayName, bio }) {
  await db
    .prepare(`UPDATE users SET display_name = ?, bio = ? WHERE id = ?`)
    .bind(displayName ?? null, bio ?? null, userId)
    .run();
}

// ── Channel ownership (a viewer who was signed in when they submitted a
// channel can self-edit its descriptive fields afterward) ──

export async function getChannelsByOwner(db, userId) {
  const { results } = await db
    .prepare(
      `SELECT id, youtube_channel_id, channel_name, channel_handle, channel_url, thumbnail_url, description, location, category, status, monitoring_enabled
       FROM channels WHERE submitted_by_user_id = ? ORDER BY created_at DESC`
    )
    .bind(userId)
    .all();
  return results;
}

// Shared ownership check — used by both the self-edit PATCH and the
// analytics GET route (functions/api/my/channels/[id]/*).
export async function getOwnedChannel(db, channelId, userId) {
  return db.prepare(`SELECT id, youtube_channel_id, channel_name, status FROM channels WHERE id = ? AND submitted_by_user_id = ?`).bind(channelId, userId).first();
}

const OWNER_EDITABLE_CHANNEL_FIELDS = { description: 'description', location: 'location', category: 'category' };

// Ownership-checked update — only succeeds (returns true) if the channel is
// actually owned by userId. Deliberately restricted to descriptive fields
// only: status/featured/verified/monitoring_enabled stay admin-only, so a
// creator editing their own listing can never self-approve or self-feature.
export async function updateOwnedChannelFields(db, channelId, userId, fields) {
  const channel = await db.prepare(`SELECT id FROM channels WHERE id = ? AND submitted_by_user_id = ?`).bind(channelId, userId).first();
  if (!channel) return false;

  const setClauses = ['updated_at = ?'];
  const values = [new Date().toISOString()];
  for (const [key, column] of Object.entries(OWNER_EDITABLE_CHANNEL_FIELDS)) {
    if (key in fields) {
      setClauses.push(`${column} = ?`);
      values.push(fields[key]);
    }
  }
  if (setClauses.length === 1) return true; // nothing to update, but ownership check passed

  values.push(channelId);
  await db.prepare(`UPDATE channels SET ${setClauses.join(', ')} WHERE id = ?`).bind(...values).run();
  return true;
}

// ── Favourites ──

export async function addFavourite(db, userId, videoId) {
  await db.prepare(`INSERT OR IGNORE INTO favourites (user_id, video_id, created_at) VALUES (?, ?, ?)`).bind(userId, videoId, nowIso()).run();
}

export async function removeFavourite(db, userId, videoId) {
  await db.prepare(`DELETE FROM favourites WHERE user_id = ? AND video_id = ?`).bind(userId, videoId).run();
}

// ── Follows (viewer -> channel) ──

export async function addFollow(db, userId, channelId) {
  await db.prepare(`INSERT OR IGNORE INTO follows (user_id, channel_id, created_at) VALUES (?, ?, ?)`).bind(userId, channelId, nowIso()).run();
}

export async function removeFollow(db, userId, channelId) {
  await db.prepare(`DELETE FROM follows WHERE user_id = ? AND channel_id = ?`).bind(userId, channelId).run();
}

export async function listFollowedChannels(db, userId) {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.youtube_channel_id, c.channel_name, c.channel_handle, c.thumbnail_url, c.category, c.location, c.verified, c.slug
       FROM follows f JOIN channels c ON c.id = f.channel_id
       WHERE f.user_id = ? AND c.status = 'approved' ORDER BY f.created_at DESC`
    )
    .bind(userId)
    .all();
  return results;
}

export async function getFollowerCount(db, channelId) {
  const row = await db.prepare(`SELECT COUNT(*) AS c FROM follows WHERE channel_id = ?`).bind(channelId).first();
  return row?.c || 0;
}

export async function listFavourites(db, userId) {
  const { results } = await db
    .prepare(
      `SELECT v.id, v.youtube_video_id, v.title, v.thumbnail_url, v.channel_name, v.published_at, v.category, v.location, v.view_count
       FROM favourites f JOIN videos v ON v.id = f.video_id
       WHERE f.user_id = ? AND v.status = 'published' ORDER BY f.created_at DESC`
    )
    .bind(userId)
    .all();
  return results;
}

// ── Rate limiting (defense-in-depth for unauthenticated write endpoints) ──

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Fixed-window counter keyed by an arbitrary string (typically "<route>:<ip>").
// Not perfectly precise under concurrent requests (read-then-write, no
// transaction) but that's an acceptable trade-off for a lightweight abuse
// guard — worst case a handful of extra requests slip through, it still
// bounds sustained abuse.
export async function checkRateLimit(db, key, maxAttempts) {
  const nowMs = Date.now();
  const row = await db.prepare(`SELECT count, window_start FROM rate_limits WHERE key = ?`).bind(key).first();

  if (!row || nowMs - new Date(row.window_start).getTime() > RATE_LIMIT_WINDOW_MS) {
    await db
      .prepare(
        `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`
      )
      .bind(key, new Date(nowMs).toISOString())
      .run();
    return { allowed: true };
  }

  if (row.count >= maxAttempts) {
    return { allowed: false };
  }

  await db.prepare(`UPDATE rate_limits SET count = count + 1 WHERE key = ?`).bind(key).run();
  return { allowed: true };
}

// ── Channel ownership claims (manual admin approval only) ──

export async function createChannelClaim(db, channelId, userId, message) {
  const id = newId();
  await db
    .prepare(`INSERT INTO channel_claims (id, channel_id, user_id, message, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`)
    .bind(id, channelId, userId, message || null, nowIso())
    .run();
  return id;
}

export async function hasPendingClaim(db, channelId, userId) {
  const row = await db
    .prepare(`SELECT id FROM channel_claims WHERE channel_id = ? AND user_id = ? AND status = 'pending'`)
    .bind(channelId, userId)
    .first();
  return !!row;
}

export async function listChannelClaims(db, status) {
  const where = status ? `WHERE cc.status = ?` : '';
  const binds = status ? [status] : [];
  const { results } = await db
    .prepare(
      `SELECT cc.id, cc.channel_id, cc.user_id, cc.message, cc.status, cc.created_at, cc.reviewed_at,
              c.channel_name, c.channel_url, c.youtube_channel_id, c.submitted_by_user_id,
              u.name AS claimant_name, u.email AS claimant_email
       FROM channel_claims cc
       JOIN channels c ON c.id = cc.channel_id
       JOIN users u ON u.id = cc.user_id
       ${where}
       ORDER BY cc.created_at DESC`
    )
    .bind(...binds)
    .all();
  return results;
}

export async function getChannelClaim(db, claimId) {
  return db.prepare(`SELECT * FROM channel_claims WHERE id = ?`).bind(claimId).first();
}

// Approving a claim attaches the claimant as the channel's owner and
// auto-rejects any other pending claims on the same channel (only one owner
// makes sense). Does nothing to the channel's approval/monitoring status —
// ownership is orthogonal to whether GorkhaTV publishes its videos.
export async function approveChannelClaim(db, claimId) {
  const claim = await db.prepare(`SELECT * FROM channel_claims WHERE id = ?`).bind(claimId).first();
  if (!claim || claim.status !== 'pending') return false;

  const ts = nowIso();
  await db.prepare(`UPDATE channels SET submitted_by_user_id = ?, updated_at = ? WHERE id = ?`).bind(claim.user_id, ts, claim.channel_id).run();
  await db.prepare(`UPDATE channel_claims SET status = 'approved', reviewed_at = ? WHERE id = ?`).bind(ts, claimId).run();
  await db
    .prepare(`UPDATE channel_claims SET status = 'rejected', reviewed_at = ? WHERE channel_id = ? AND status = 'pending' AND id != ?`)
    .bind(ts, claim.channel_id, claimId)
    .run();
  return true;
}

export async function rejectChannelClaim(db, claimId) {
  await db.prepare(`UPDATE channel_claims SET status = 'rejected', reviewed_at = ? WHERE id = ? AND status = 'pending'`).bind(nowIso(), claimId).run();
}

// ── Shorts feed personalization (v1 weighted scoring, see shared/constants.js) ──

// Resolves a stable key for shorts_affinity rows: the signed-in viewer's real
// user id when there's a valid session, otherwise a long-lived anonymous
// cookie token (created on first use) — personalization works without
// requiring sign-in, matching the plan's "per-session if no auth yet" ask.
// Returns { sessionKey, setCookieHeader } — setCookieHeader is non-null only
// when a fresh anon token was just minted and the caller needs to send it.
export async function resolveSessionKey(db, request) {
  const cookies = parseCookies(request.headers.get('Cookie'));

  const user = await getSessionUser(db, cookies[VIEWER_SESSION_COOKIE]);
  if (user) return { sessionKey: user.id, setCookieHeader: null };

  if (cookies[ANON_SESSION_COOKIE]) return { sessionKey: cookies[ANON_SESSION_COOKIE], setCookieHeader: null };

  const token = randomToken();
  return { sessionKey: token, setCookieHeader: buildSetCookie(ANON_SESSION_COOKIE, token, { maxAgeSeconds: ANON_SESSION_TTL_SECONDS }) };
}

export async function bumpShortsAffinity(db, sessionKey, dimension, value, delta) {
  if (!sessionKey || !value) return;
  await db
    .prepare(
      `INSERT INTO shorts_affinity (session_key, dimension, value, score, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session_key, dimension, value) DO UPDATE SET
         score = score + excluded.score,
         updated_at = excluded.updated_at`
    )
    .bind(sessionKey, dimension, value, delta, nowIso())
    .run();
}

// Returns { category: Map(slug -> score), channel: Map(youtube_channel_id -> score) }
// for one viewer — used by functions/api/shorts.js to score a candidate pool.
export async function getShortsAffinity(db, sessionKey) {
  const empty = { category: new Map(), channel: new Map() };
  if (!sessionKey) return empty;
  const { results } = await db.prepare(`SELECT dimension, value, score FROM shorts_affinity WHERE session_key = ?`).bind(sessionKey).all();
  for (const row of results) {
    (row.dimension === 'category' ? empty.category : empty.channel).set(row.value, row.score);
  }
  return empty;
}

// ── Watch progress + regular-video affinity (homepage "Continue Watching" / "Because You Liked") ──

export async function upsertWatchProgress(db, sessionKey, youtubeVideoId, progressSeconds, durationSeconds) {
  if (!sessionKey || !youtubeVideoId) return;
  await db
    .prepare(
      `INSERT INTO watch_progress (session_key, youtube_video_id, progress_seconds, duration_seconds, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session_key, youtube_video_id) DO UPDATE SET
         progress_seconds = excluded.progress_seconds,
         duration_seconds = excluded.duration_seconds,
         updated_at = excluded.updated_at`
    )
    .bind(sessionKey, youtubeVideoId, Math.round(progressSeconds), durationSeconds ? Math.round(durationSeconds) : null, nowIso())
    .run();
}

export async function getWatchProgress(db, sessionKey, youtubeVideoId) {
  if (!sessionKey) return null;
  return db
    .prepare(`SELECT progress_seconds, duration_seconds FROM watch_progress WHERE session_key = ? AND youtube_video_id = ?`)
    .bind(sessionKey, youtubeVideoId)
    .first();
}

// Videos this viewer started but didn't finish — excludes near-the-start
// (likely an accidental open) and near-the-end (effectively done watching).
export async function getContinueWatching(db, sessionKey, limit = 12) {
  if (!sessionKey) return [];
  const { results } = await db
    .prepare(
      `SELECT v.id, v.youtube_video_id, v.title, v.thumbnail_url, v.channel_name, v.channel_handle,
              v.youtube_channel_id, v.published_at, v.category, v.location,
              wp.progress_seconds, wp.duration_seconds
       FROM watch_progress wp
       JOIN videos v ON v.youtube_video_id = wp.youtube_video_id
       WHERE wp.session_key = ? AND v.status = 'published'
         AND wp.progress_seconds > 10
         AND wp.duration_seconds IS NOT NULL
         AND wp.progress_seconds < wp.duration_seconds * 0.9
       ORDER BY wp.updated_at DESC LIMIT ?`
    )
    .bind(sessionKey, limit)
    .all();
  return results;
}

export async function bumpVideoAffinity(db, sessionKey, dimension, value, delta) {
  if (!sessionKey || !value) return;
  await db
    .prepare(
      `INSERT INTO video_affinity (session_key, dimension, value, score, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session_key, dimension, value) DO UPDATE SET
         score = score + excluded.score,
         updated_at = excluded.updated_at`
    )
    .bind(sessionKey, dimension, value, delta, nowIso())
    .run();
}

// Returns the single highest-scoring channel and category for one viewer, or
// null for either if there's no signal yet — used by
// functions/api/home/personalized.js to pick what "Because You Liked" means.
export async function getTopVideoAffinity(db, sessionKey) {
  if (!sessionKey) return { topChannel: null, topCategory: null };
  const [topChannel, topCategory] = await Promise.all([
    db.prepare(`SELECT value, score FROM video_affinity WHERE session_key = ? AND dimension = 'channel' ORDER BY score DESC LIMIT 1`).bind(sessionKey).first(),
    db.prepare(`SELECT value, score FROM video_affinity WHERE session_key = ? AND dimension = 'category' ORDER BY score DESC LIMIT 1`).bind(sessionKey).first(),
  ]);
  return { topChannel: topChannel || null, topCategory: topCategory || null };
}

// ── Video comments cache (real YouTube comments, read-only — see shared/youtube.js's listCommentThreads) ──

export async function getCachedComments(db, youtubeVideoId) {
  return db.prepare(`SELECT comments_json, status, fetched_at FROM video_comments_cache WHERE youtube_video_id = ?`).bind(youtubeVideoId).first();
}

export async function setCachedComments(db, youtubeVideoId, commentsJson, status = 'ok') {
  await db
    .prepare(
      `INSERT INTO video_comments_cache (youtube_video_id, comments_json, status, fetched_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(youtube_video_id) DO UPDATE SET
         comments_json = excluded.comments_json,
         status = excluded.status,
         fetched_at = excluded.fetched_at`
    )
    .bind(youtubeVideoId, commentsJson, status, nowIso())
    .run();
}

// ── On-site view tracking (drives the homepage Trending row) ──

export async function recordVideoView(db, youtubeVideoId) {
  await db
    .prepare(
      `INSERT INTO video_view_daily (youtube_video_id, view_date, view_count) VALUES (?, ?, 1)
       ON CONFLICT(youtube_video_id, view_date) DO UPDATE SET view_count = view_count + 1`
    )
    .bind(youtubeVideoId, todayKey())
    .run();
}

export async function addQuotaUsage(db, units, isSearchCall = false) {
  const date = todayKey();
  await db
    .prepare(
      `INSERT INTO quota_usage (date, units_used, search_calls_used) VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         units_used = units_used + excluded.units_used,
         search_calls_used = search_calls_used + excluded.search_calls_used`
    )
    .bind(date, units, isSearchCall ? 1 : 0)
    .run();
}

// ── Site analytics (DAU/MAU, new-vs-returning, watch time) ──

// Fired once per page load (see gorkhatv2/js/auth.js's initAuthNav) — records
// that this session_key was active today, and (via INSERT OR IGNORE) the
// first date it was ever seen at all, so "new vs returning" never requires
// scanning the full activity history.
export async function recordSessionActivity(db, sessionKey) {
  if (!sessionKey) return;
  const date = todayKey();
  await Promise.all([
    db
      .prepare(
        `INSERT INTO session_activity_daily (session_key, activity_date, page_views) VALUES (?, ?, 1)
         ON CONFLICT(session_key, activity_date) DO UPDATE SET page_views = page_views + 1`
      )
      .bind(sessionKey, date)
      .run(),
    db.prepare(`INSERT OR IGNORE INTO session_first_seen (session_key, first_seen_date) VALUES (?, ?)`).bind(sessionKey, date).run(),
  ]);
}

// Approximate watch-time accumulator — deltaSeconds is the caller's already-
// clamped difference between successive progress-sync pings (see
// functions/api/videos/[id]/progress.js), not a raw event log.
export async function bumpWatchTime(db, sessionKey, deltaSeconds) {
  if (!sessionKey || deltaSeconds <= 0) return;
  await db
    .prepare(
      `INSERT INTO watch_time_daily (session_key, watch_date, seconds_watched) VALUES (?, ?, ?)
       ON CONFLICT(session_key, watch_date) DO UPDATE SET seconds_watched = seconds_watched + excluded.seconds_watched`
    )
    .bind(sessionKey, todayKey(), deltaSeconds)
    .run();
}

// ── Native video comments (see functions/api/videos/[id]/native-comments/*
// and functions/api/comments/* — NOT video_comments_cache, the separate
// read-only YouTube-comments mirror used by Shorts/Feed) ──

export async function insertVideoComment(db, { youtubeVideoId, userId, parentCommentId, body, authorName, authorAvatarUrl }) {
  const id = newId();
  const ts = nowIso();
  await db
    .prepare(
      `INSERT INTO video_comments (id, youtube_video_id, user_id, parent_comment_id, body, author_name, author_avatar_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, youtubeVideoId, userId, parentCommentId || null, body, authorName, authorAvatarUrl || null, ts)
    .run();
  return { id, createdAt: ts };
}

export async function listTopLevelComments(db, youtubeVideoId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const { results } = await db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM video_comments r WHERE r.parent_comment_id = c.id) AS reply_count
       FROM video_comments c
       WHERE c.youtube_video_id = ? AND c.parent_comment_id IS NULL
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(youtubeVideoId, limit, offset)
    .all();
  return results;
}

export async function countTopLevelComments(db, youtubeVideoId) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS total FROM video_comments WHERE youtube_video_id = ? AND parent_comment_id IS NULL`)
    .bind(youtubeVideoId)
    .first();
  return row?.total || 0;
}

// Oldest-first (chronological reply order) — capped, no further pagination
// in v1; revisit if a single thread ever exceeds this in practice.
export async function listCommentReplies(db, parentCommentId, limit = 50) {
  const { results } = await db
    .prepare(`SELECT * FROM video_comments WHERE parent_comment_id = ? ORDER BY created_at ASC LIMIT ?`)
    .bind(parentCommentId, limit)
    .all();
  return results;
}

export async function getCommentById(db, id) {
  return db.prepare(`SELECT * FROM video_comments WHERE id = ?`).bind(id).first();
}

// Deletes a comment; if it's a top-level comment, cascades to its replies
// (hard delete, no tombstone — see Phase J plan for the tradeoff).
export async function deleteCommentCascade(db, id) {
  await db.prepare(`DELETE FROM video_comments WHERE id = ? OR parent_comment_id = ?`).bind(id, id).run();
}

export async function listAllCommentsAdmin(db, { page = 1, limit = 30 } = {}) {
  const offset = (page - 1) * limit;
  const { results } = await db
    .prepare(
      `SELECT c.id, c.body, c.author_name, c.parent_comment_id, c.created_at, c.youtube_video_id, v.title AS video_title
       FROM video_comments c LEFT JOIN videos v ON v.youtube_video_id = c.youtube_video_id
       ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
    )
    .bind(limit, offset)
    .all();
  return results;
}

export async function countAllComments(db) {
  const row = await db.prepare(`SELECT COUNT(*) AS total FROM video_comments`).first();
  return row?.total || 0;
}
