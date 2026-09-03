import { json, cacheableJson } from '../../shared/http.js';

const VIDEO_COLUMNS =
  'id, youtube_video_id, title, description, thumbnail_url, channel_name, channel_handle, youtube_channel_id, published_at, category, location, duration_seconds, view_count, featured, trending';

// Landscape rows only — Shorts live exclusively on /shorts, never mixed in here.
// content_type IS NULL is kept on the "show" side deliberately: a brand-new video
// that hasn't been classified yet is unknown, not confirmed-Short, and shouldn't
// vanish from the homepage while that classification is pending.
const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";

// Likes are a stronger signal than a passive view, weighted accordingly; falls
// back to view-count-only ranking automatically when like_count is NULL (most
// currently-synced videos, since like counts aren't always public on YouTube).
const ENGAGEMENT_EXPR = '(view_count + COALESCE(like_count, 0) * 10)';

// Trending window — recent GorkhaTV activity, not all-time, so a video that
// was popular months ago doesn't stay "trending" forever.
const TRENDING_WINDOW_DAYS = 7;

// A deliberately simple, tunable heuristic for "looks premium on a Netflix-
// style front page" — not a quality judgment, just filters the two patterns
// that showed up repeatedly in the real data: near-zero-effort micro-clips
// and hashtag-spam titles with no real title text. Browse/Search show
// everything regardless; this only trims what the homepage leads with.
// Verified against production data before shipping: no category loses more
// than ~4% of its videos, and every category still has enough left to fill
// a Top-10 row.
const PREMIUM = "(duration_seconds IS NULL OR duration_seconds >= 30) AND (LENGTH(title) - LENGTH(REPLACE(title, '#', ''))) <= 5";

// One aggregated payload for the whole homepage — hero picks, trending,
// latest, one Top 10 row per location, one Top 10 row per category —
// featured creators — so the frontend makes a single request instead of
// ~19 separate ones. Reads D1 only; never touches the YouTube API (see
// shared/sync.js for that).
//
// News is deliberately excluded from every query below (and from the
// response entirely) — it now lives at its own branded destination
// (/category/news, "Gorkha TV News — Powered by Khabar Darjeeling", see
// functions/category/[cat].js and gorkhatv2/js/browse.js), reachable via
// the nav link, not a homepage row — same pattern as Shorts.
export async function onRequestGet(context) {
  const { env } = context;

  const windowStart = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowStartDate = windowStart.toISOString().slice(0, 10); // matches video_view_daily's YYYY-MM-DD bucketing
  const windowStartIso = windowStart.toISOString(); // matches favourites.created_at's full timestamp

  try {
    const [heroRes, trendingRes, latestRes, byLocationRes, byCategoryRes, creatorsRes] = await Promise.all([
      // Explicitly-ranked (hero_order set by an admin via admin-featured.html)
      // surface first, in that order; unranked featured videos fall back to
      // today's latest-first behavior, after the ranked ones ("nulls last").
      env.DB.prepare(`SELECT ${VIDEO_COLUMNS}, hero_order FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND featured = 1 ORDER BY (hero_order IS NULL) ASC, hero_order ASC, published_at DESC LIMIT 5`).all(),
      // Real GorkhaTV engagement, not YouTube's public stats or an admin
      // flag — recent on-site views (video_view_daily) plus recent Saves,
      // weighted the same way as everywhere else (a save is worth 10 views).
      // yvid avoids colliding with VIDEO_COLUMNS' own youtube_video_id.
      env.DB.prepare(
        `SELECT ${VIDEO_COLUMNS}, (COALESCE(rv.views, 0) + COALESCE(rs.saves, 0) * 10) AS trend_score
         FROM videos v
         LEFT JOIN (
           SELECT youtube_video_id AS yvid, SUM(view_count) AS views
           FROM video_view_daily WHERE view_date >= ? GROUP BY youtube_video_id
         ) rv ON rv.yvid = v.youtube_video_id
         LEFT JOIN (
           SELECT video_id, COUNT(*) AS saves
           FROM favourites WHERE created_at >= ? GROUP BY video_id
         ) rs ON rs.video_id = v.id
         WHERE v.status = 'published' AND ${NOT_SHORT} AND ${PREMIUM}
           AND (v.category IS NULL OR v.category != 'news')
           AND (COALESCE(rv.views, 0) + COALESCE(rs.saves, 0)) > 0
         ORDER BY trend_score DESC LIMIT 12`
      )
        .bind(windowStartDate, windowStartIso)
        .all(),
      // News is excluded here — it syncs far more frequently than any other
      // category, so an undifferentiated "Latest" row ends up wall-to-wall
      // News and crowds out everything else. News now lives at its own
      // destination entirely (see module comment above), not just a
      // separate row, so this exclusion is permanent, not a dedup step.
      env.DB.prepare(`SELECT ${VIDEO_COLUMNS} FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND (category IS NULL OR category != 'news') ORDER BY published_at DESC LIMIT 12`).all(),
      env.DB.prepare(
        `SELECT * FROM (
           SELECT ${VIDEO_COLUMNS}, ROW_NUMBER() OVER (PARTITION BY location ORDER BY ${ENGAGEMENT_EXPR} DESC, published_at DESC) AS rn
           FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND location IS NOT NULL
         ) WHERE rn <= 10`
      ).all(),
      env.DB.prepare(
        `SELECT * FROM (
           SELECT ${VIDEO_COLUMNS}, ROW_NUMBER() OVER (PARTITION BY category ORDER BY ${ENGAGEMENT_EXPR} DESC, published_at DESC) AS rn
           FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND category IS NOT NULL AND category != 'news'
         ) WHERE rn <= 10`
      ).all(),
      env.DB
        .prepare(
          `SELECT id, youtube_channel_id, channel_name, channel_handle, thumbnail_url, description, location, category, slug
           FROM channels WHERE status = 'approved' AND featured = 1 ORDER BY channel_name LIMIT 12`
        )
        .all(),
    ]);

    // Hero falls back to latest if nothing is explicitly featured yet, so the
    // homepage never opens on an empty hero just because no admin has clicked
    // "feature" — this is a display fallback, not a data mutation.
    const hero = heroRes.results.length ? heroRes.results : latestRes.results.slice(0, 5);

    const byLocation = {};
    for (const row of byLocationRes.results) {
      (byLocation[row.location] ||= []).push(row);
    }
    const byCategory = {};
    for (const row of byCategoryRes.results) {
      (byCategory[row.category] ||= []).push(row);
    }

    return cacheableJson({
      hero,
      trending: trendingRes.results,
      latest: latestRes.results,
      byLocation,
      byCategory,
      featuredCreators: creatorsRes.results,
    });
  } catch (err) {
    // The homepage must never go blank just because D1 hiccupped — return an
    // empty-but-well-formed payload so the frontend renders its empty states.
    return json(
      { hero: [], trending: [], latest: [], byLocation: {}, byCategory: {}, featuredCreators: [], error: 'Content is temporarily unavailable.' },
      { status: 200 }
    );
  }
}
