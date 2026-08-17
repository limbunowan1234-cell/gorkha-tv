import { cacheableJson, errorResponse } from '../../../shared/http.js';

const VIDEO_COLUMNS =
  'id, youtube_video_id, title, description, thumbnail_url, channel_name, channel_handle, youtube_channel_id, published_at, category, location, duration_seconds, view_count, featured, trending';

const SORTS = {
  latest: 'published_at DESC',
  trending: 'trending DESC, published_at DESC',
  popular: 'view_count DESC',
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const location = url.searchParams.get('location');
  const channelId = url.searchParams.get('channelId');
  const sort = SORTS[url.searchParams.get('sort')] || SORTS.latest;
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(48, Math.max(1, Number(url.searchParams.get('limit')) || 24));
  const offset = (page - 1) * limit;

  const clauses = ["status = 'published'"];
  const binds = [];
  if (category) {
    clauses.push('category = ?');
    binds.push(category);
  }
  if (location) {
    clauses.push('location = ?');
    binds.push(location);
  }
  if (channelId) {
    clauses.push('youtube_channel_id = ?');
    binds.push(channelId);
  }
  const where = `WHERE ${clauses.join(' AND ')}`;

  try {
    const [{ results }, countRow] = await Promise.all([
      env.DB.prepare(`SELECT ${VIDEO_COLUMNS} FROM videos ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`).bind(...binds, limit, offset).all(),
      env.DB.prepare(`SELECT COUNT(*) as total FROM videos ${where}`).bind(...binds).first(),
    ]);
    return cacheableJson({ videos: results, total: countRow?.total || 0, page, limit });
  } catch (err) {
    return errorResponse('Videos are temporarily unavailable.', 503);
  }
}
