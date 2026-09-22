import { json, cacheableJson } from '../../../shared/http.js';

const VIDEO_COLUMNS =
  'id, youtube_video_id, title, description, thumbnail_url, channel_name, channel_handle, youtube_channel_id, published_at, category, location, duration_seconds, view_count';

const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";
const PREMIUM = "(duration_seconds IS NULL OR duration_seconds >= 30) AND (LENGTH(title) - LENGTH(REPLACE(title, '#', ''))) <= 5";
const ENGAGEMENT_EXPR = '(view_count + COALESCE(like_count, 0) * 10)';
const TRENDING_WINDOW_DAYS = 7;

// Backs each genre's own themed page (functions/genre/[slug].js /
// gorkhatv2/js/genre.js) — one combined-region (never split by location)
// Trending row plus a Latest row, both scoped to a single category. Same
// real on-site engagement signal as the homepage's own Trending row (recent
// video_view_daily views + recent favourites, a save worth 10 views) rather
// than raw YouTube stats, so "trending" means the same thing everywhere on
// the site. Music has its own richer Top10->Top100 flow (see /api/chart)
// and never calls this route.
export async function onRequestGet(context) {
  const { env, params } = context;
  const category = params.category;

  const windowStart = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowStartDate = windowStart.toISOString().slice(0, 10);
  const windowStartIso = windowStart.toISOString();

  try {
    const [trendingRes, latestRes, byLocationRes] = await Promise.all([
      env.DB.prepare(
        `SELECT ${VIDEO_COLUMNS}, (COALESCE(rv.views, 0) + COALESCE(rs.saves, 0) * 10) AS trend_score
         FROM videos v
         LEFT JOIN (
           SELECT youtube_video_id AS yvid, SUM(view_count) AS views
           FROM video_view_daily WHERE view_date >= ?1 GROUP BY youtube_video_id
         ) rv ON rv.yvid = v.youtube_video_id
         LEFT JOIN (
           SELECT video_id, COUNT(*) AS saves
           FROM favourites WHERE created_at >= ?2 GROUP BY video_id
         ) rs ON rs.video_id = v.id
         WHERE v.status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND v.category = ?3
           AND (COALESCE(rv.views, 0) + COALESCE(rs.saves, 0)) > 0
         ORDER BY trend_score DESC LIMIT 12`
      )
        .bind(windowStartDate, windowStartIso, category)
        .all(),
      env.DB
        .prepare(
          `SELECT ${VIDEO_COLUMNS} FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND category = ?1 ORDER BY published_at DESC LIMIT 12`
        )
        .bind(category)
        .all(),
      // One Top 10 per region, within this genre only — same ROW_NUMBER()
      // "nulls last on ties" pattern as functions/api/home.js's byLocation,
      // just scoped to a single category instead of the whole catalog.
      // Called for every genre kind, including music (its page shows this
      // below the Top10->Top100 flow, not trending/latest).
      env.DB
        .prepare(
          `SELECT * FROM (
             SELECT ${VIDEO_COLUMNS}, ROW_NUMBER() OVER (PARTITION BY location ORDER BY ${ENGAGEMENT_EXPR} DESC, published_at DESC) AS rn
             FROM videos WHERE status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND category = ?1 AND location IS NOT NULL
           ) WHERE rn <= 10`
        )
        .bind(category)
        .all(),
    ]);

    const byLocation = {};
    for (const row of byLocationRes.results) {
      (byLocation[row.location] ||= []).push(row);
    }

    // byLocation is a window-function rank-per-group query, same story as
    // functions/api/home.js's byLocation/byCategory — genuinely has to scan
    // every video in the category to rank it (verified: forcing the
    // category index didn't reduce rows_read at all). Bumped to 600s/3000s
    // to match home.js/chart.js/top-artists.js's cache convention.
    return cacheableJson({ trending: trendingRes.results, latest: latestRes.results, byLocation }, 600);
  } catch (err) {
    return json({ trending: [], latest: [], byLocation: {}, error: 'Genre content is temporarily unavailable.' }, { status: 200 });
  }
}
