import { json, errorResponse } from '../../../../../shared/http.js';
import { getOwnedChannel, todayKey } from '../../../../../shared/db.js';

// Analytics for a channel the signed-in viewer owns — only once it's
// actually approved (a pending/rejected submission has no published videos
// to report on, and showing "0 views" there would just read as broken).
export async function onRequestGet(context) {
  const { env, params, data } = context;
  const channel = await getOwnedChannel(env.DB, params.id, data.user.id);
  if (!channel) return errorResponse('Channel not found or not owned by you.', 404);
  if (channel.status !== 'approved') return errorResponse('Analytics are available once this channel is approved.', 409);

  const db = env.DB;
  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [totals, topVideo, trend] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS videoCount, COALESCE(SUM(view_count),0) AS totalViews, COALESCE(SUM(like_count),0) AS totalLikes
         FROM videos WHERE youtube_channel_id = ? AND status = 'published'`
      )
      .bind(channel.youtube_channel_id)
      .first(),
    db
      .prepare(
        `SELECT youtube_video_id, title, thumbnail_url, view_count FROM videos
         WHERE youtube_channel_id = ? AND status = 'published' ORDER BY view_count DESC LIMIT 1`
      )
      .bind(channel.youtube_channel_id)
      .first(),
    db
      .prepare(
        `SELECT vvd.view_date, SUM(vvd.view_count) AS views
         FROM video_view_daily vvd JOIN videos v ON v.youtube_video_id = vvd.youtube_video_id
         WHERE v.youtube_channel_id = ? AND vvd.view_date >= ?
         GROUP BY vvd.view_date ORDER BY vvd.view_date`
      )
      .bind(channel.youtube_channel_id, weekAgo)
      .all(),
  ]);

  const videoCount = totals.videoCount || 0;
  const totalViews = totals.totalViews || 0;

  // Per-viewer, ownership-gated data — never cache this response.
  return json(
    {
      analytics: {
        videoCount,
        totalViews,
        totalLikes: totals.totalLikes || 0,
        avgViews: videoCount ? Math.round(totalViews / videoCount) : 0,
        topVideo: topVideo || null,
        viewsTrend: trend.results, // last 7 days of on-site view activity — see functions/api/videos/[id]/view.js
        asOf: todayKey(),
      },
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
