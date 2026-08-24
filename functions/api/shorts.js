import { cacheableJson, errorResponse } from '../../shared/http.js';

// Shorts feed — deliberately separate from /api/videos so the vertical
// swipe feed never mixes with the landscape browse rows. Cursor-paginated
// (not page/offset) since the client keeps appending to an infinite feed.
const SHORT_COLUMNS =
  'id, youtube_video_id, title, channel_name, channel_handle, youtube_channel_id, thumbnail_url, published_at, category, location, view_count';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor'); // ISO published_at of the last item the client already has
  const excludeId = url.searchParams.get('exclude'); // youtube_video_id already shown first (deep link), don't repeat it
  const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit')) || 10));

  const clauses = ["status = 'published'", "content_type = 'short'"];
  const binds = [];
  if (cursor) {
    clauses.push('published_at < ?');
    binds.push(cursor);
  }
  if (excludeId) {
    clauses.push('youtube_video_id != ?');
    binds.push(excludeId);
  }
  const where = `WHERE ${clauses.join(' AND ')}`;

  try {
    const { results } = await env.DB.prepare(`SELECT ${SHORT_COLUMNS} FROM videos ${where} ORDER BY published_at DESC LIMIT ?`)
      .bind(...binds, limit)
      .all();
    const nextCursor = results.length === limit ? results[results.length - 1].published_at : null;
    return cacheableJson({ shorts: results, nextCursor }, 30);
  } catch (err) {
    return errorResponse('Shorts are temporarily unavailable.', 503);
  }
}
