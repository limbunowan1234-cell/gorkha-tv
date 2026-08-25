import { json, errorResponse } from '../../../../shared/http.js';
import { recordVideoView, checkRateLimit } from '../../../../shared/db.js';

// :id is the YouTube video id. Fired client-side from js/watch.js once a
// viewer's browser actually renders the watch page — deliberately NOT
// tracked in the SSR route (functions/watch/[id].js), which also serves
// bots/crawlers/link-preview fetchers that would otherwise inflate counts.
// Rate-limited per IP since this is an unauthenticated write endpoint, same
// defense-in-depth pattern as the other public write routes.
const MAX_VIEWS_PER_WINDOW = 60;

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  const { allowed } = await checkRateLimit(env.DB, `video-view:${ip}`, MAX_VIEWS_PER_WINDOW);
  if (!allowed) return errorResponse('Too many requests.', 429);

  try {
    await recordVideoView(env.DB, params.id);
    return json({ ok: true });
  } catch (err) {
    // View tracking is best-effort — never surface this as a user-facing error.
    return json({ ok: false });
  }
}
