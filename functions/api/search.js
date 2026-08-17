import { json, errorResponse } from '../../shared/http.js';

const VIDEO_COLUMNS =
  'id, youtube_video_id, title, thumbnail_url, channel_name, published_at, category, location, duration_seconds, view_count';
const CREATOR_COLUMNS = 'id, youtube_channel_id, channel_name, channel_handle, thumbnail_url, location, category';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  if (!q) return json({ videos: [], creators: [], query: '' });

  const like = `%${q}%`;

  try {
    const [videosRes, creatorsRes] = await Promise.all([
      env.DB
        .prepare(
          `SELECT ${VIDEO_COLUMNS} FROM videos
           WHERE status = 'published' AND (title LIKE ? OR description LIKE ? OR channel_name LIKE ? OR category LIKE ? OR location LIKE ? OR tags LIKE ?)
           ORDER BY published_at DESC LIMIT 30`
        )
        .bind(like, like, like, like, like, like)
        .all(),
      env.DB
        .prepare(
          `SELECT ${CREATOR_COLUMNS} FROM channels
           WHERE status = 'approved' AND (channel_name LIKE ? OR description LIKE ? OR category LIKE ? OR location LIKE ?)
           ORDER BY channel_name LIMIT 20`
        )
        .bind(like, like, like, like)
        .all(),
    ]);

    return json({ videos: videosRes.results, creators: creatorsRes.results, query: q });
  } catch (err) {
    return errorResponse('Search is temporarily unavailable.', 503);
  }
}
