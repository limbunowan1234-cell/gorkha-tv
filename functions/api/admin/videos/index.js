import { json, errorResponse, readJsonBody } from '../../../../shared/http.js';
import { addVideoManually } from '../../../../shared/sync.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const category = url.searchParams.get('category');
  const featured = url.searchParams.get('featured');
  const q = url.searchParams.get('q');
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 30));
  const offset = (page - 1) * limit;

  const clauses = [];
  const binds = [];
  if (status) {
    clauses.push('status = ?');
    binds.push(status);
  }
  if (category) {
    clauses.push('category = ?');
    binds.push(category);
  }
  if (featured === '1' || featured === '0') {
    clauses.push('featured = ?');
    binds.push(featured === '1' ? 1 : 0);
  }
  if (q) {
    clauses.push('(title LIKE ? OR channel_name LIKE ?)');
    binds.push(`%${q}%`, `%${q}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const listStmt = env.DB.prepare(`SELECT * FROM videos ${where} ORDER BY published_at DESC LIMIT ? OFFSET ?`).bind(
    ...binds,
    limit,
    offset
  );
  const countStmt = env.DB.prepare(`SELECT COUNT(*) as total FROM videos ${where}`).bind(...binds);

  const [{ results }, countRow] = await Promise.all([listStmt.all(), countStmt.first()]);

  return json({ videos: results, total: countRow?.total || 0, page, limit });
}

// Manual "add by URL/ID" — bypasses relevance scoring since an admin adding
// it directly is itself the approval signal.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.YOUTUBE_API_KEY) return errorResponse('YOUTUBE_API_KEY is not configured on this deployment.', 500);

  const body = await readJsonBody(request);
  const videoUrlOrId = body?.videoUrlOrId;
  if (!videoUrlOrId || typeof videoUrlOrId !== 'string') {
    return errorResponse('videoUrlOrId is required.', 400);
  }

  try {
    const video = await addVideoManually(env, videoUrlOrId, { category: body?.category, location: body?.location });
    return json({ ok: true, video });
  } catch (err) {
    return errorResponse(err.message || 'Failed to add video.', 400);
  }
}
