// D1 access helpers. Every function takes a D1Database handle (`db`) as its
// first argument instead of importing a global — keeps this module usable from
// Pages Functions, the standalone sync Worker, and any future backend that
// hands us a D1-compatible binding.

import { randomToken } from './auth.js';

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
  values.push(id);
  await db.prepare(`UPDATE channels SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
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
         trending, source, discovered_at, approved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`
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

function todayKey() {
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

// ── Favourites ──

export async function addFavourite(db, userId, videoId) {
  await db.prepare(`INSERT OR IGNORE INTO favourites (user_id, video_id, created_at) VALUES (?, ?, ?)`).bind(userId, videoId, nowIso()).run();
}

export async function removeFavourite(db, userId, videoId) {
  await db.prepare(`DELETE FROM favourites WHERE user_id = ? AND video_id = ?`).bind(userId, videoId).run();
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
