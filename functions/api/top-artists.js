import { cacheableJson } from '../../shared/http.js';

const NOT_SHORT = "(content_type IS NULL OR content_type != 'short')";
const PREMIUM = "(duration_seconds IS NULL OR duration_seconds >= 30) AND (LENGTH(title) - LENGTH(REPLACE(title, '#', ''))) <= 5";

// "Top Artists" — GorkhaTV Beats' companion to the Top 100 Hills Hits song
// chart (see /api/chart): same engagement signal (view_count + likes*10),
// summed per artist (channel) across their whole music catalog instead of
// ranked per song — so a prolific artist with many solid songs ranks
// alongside one with a single huge hit, not just whoever has the single
// biggest video. Requested directly, alongside the related-videos fix that
// stopped "up next" from being dominated by one artist's whole catalog.
export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      `SELECT c.youtube_channel_id, c.channel_name, c.thumbnail_url, c.slug,
              SUM(v.view_count + COALESCE(v.like_count, 0) * 10) AS total_engagement,
              COUNT(*) AS video_count
       FROM videos v
       JOIN channels c ON c.youtube_channel_id = v.youtube_channel_id
       WHERE v.status = 'published' AND ${NOT_SHORT} AND ${PREMIUM} AND v.category = 'music' AND c.status = 'approved'
       GROUP BY v.youtube_channel_id
       ORDER BY total_engagement DESC
       LIMIT 20`
    ).all();
    return cacheableJson({ artists: results }, 600);
  } catch (err) {
    return cacheableJson({ artists: [], error: 'Top artists are temporarily unavailable.' }, 60);
  }
}
