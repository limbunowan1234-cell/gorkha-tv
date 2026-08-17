import { json } from '../../../../shared/http.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));

  const [{ results: runs }, { results: errors }] = await Promise.all([
    env.DB.prepare('SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT ?').bind(limit).all(),
    env.DB.prepare('SELECT * FROM sync_errors ORDER BY created_at DESC LIMIT 50').all(),
  ]);

  return json({ runs, recentErrors: errors });
}
