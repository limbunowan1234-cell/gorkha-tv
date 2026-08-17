import { json, cacheableJson } from '../../shared/http.js';

const VIDEO_COLUMNS =
  'id, youtube_video_id, title, description, thumbnail_url, channel_name, channel_handle, youtube_channel_id, published_at, category, location, duration_seconds, view_count, featured, trending';

// One aggregated payload for the whole homepage — hero picks, trending,
// latest, one row per location, one row per category, featured creators —
// so the frontend makes a single request instead of ~19 separate ones.
// Reads D1 only; never touches the YouTube API (see shared/sync.js for that).
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const [heroRes, trendingRes, latestRes, byLocationRes, byCategoryRes, creatorsRes] = await Promise.all([
      env.DB.prepare(`SELECT ${VIDEO_COLUMNS} FROM videos WHERE status = 'published' AND featured = 1 ORDER BY published_at DESC LIMIT 5`).all(),
      env.DB.prepare(`SELECT ${VIDEO_COLUMNS} FROM videos WHERE status = 'published' AND trending = 1 ORDER BY published_at DESC LIMIT 12`).all(),
      env.DB.prepare(`SELECT ${VIDEO_COLUMNS} FROM videos WHERE status = 'published' ORDER BY published_at DESC LIMIT 12`).all(),
      env.DB.prepare(
        `SELECT * FROM (
           SELECT ${VIDEO_COLUMNS}, ROW_NUMBER() OVER (PARTITION BY location ORDER BY published_at DESC) AS rn
           FROM videos WHERE status = 'published' AND location IS NOT NULL
         ) WHERE rn <= 12`
      ).all(),
      env.DB.prepare(
        `SELECT * FROM (
           SELECT ${VIDEO_COLUMNS}, ROW_NUMBER() OVER (PARTITION BY category ORDER BY published_at DESC) AS rn
           FROM videos WHERE status = 'published' AND category IS NOT NULL
         ) WHERE rn <= 12`
      ).all(),
      env.DB
        .prepare(
          `SELECT id, youtube_channel_id, channel_name, channel_handle, thumbnail_url, description, location, category
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
