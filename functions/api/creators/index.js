import { cacheableJson, errorResponse } from '../../../shared/http.js';

const CREATOR_COLUMNS = 'id, youtube_channel_id, channel_name, channel_handle, channel_url, thumbnail_url, description, location, category, verified, featured';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const location = url.searchParams.get('location');

  const clauses = ["status = 'approved'"];
  const binds = [];
  if (category) {
    clauses.push('category = ?');
    binds.push(category);
  }
  if (location) {
    clauses.push('location = ?');
    binds.push(location);
  }

  try {
    const { results } = await env.DB
      .prepare(`SELECT ${CREATOR_COLUMNS} FROM channels WHERE ${clauses.join(' AND ')} ORDER BY featured DESC, channel_name`)
      .bind(...binds)
      .all();
    return cacheableJson({ creators: results }, 120);
  } catch (err) {
    return errorResponse('Creators are temporarily unavailable.', 503);
  }
}
