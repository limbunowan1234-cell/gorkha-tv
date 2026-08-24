import { json, errorResponse, readJsonBody } from '../../../shared/http.js';
import { parseCookies } from '../../../shared/auth.js';
import { getSessionUser, createChannelClaim, hasPendingClaim, checkRateLimit } from '../../../shared/db.js';
import { VIEWER_SESSION_COOKIE } from '../../../shared/constants.js';

const MAX_CLAIMS_PER_WINDOW = 5;

// Public route, but requires a signed-in viewer (checked inline rather than
// via a subtree _middleware, since /api/creators/* also has genuinely public
// routes like index.js and [id].js). Creates a 'pending' request only —
// approval is always a manual admin decision (functions/api/admin/claims/*).
export async function onRequestPost(context) {
  const { request, env } = context;

  const cookies = parseCookies(request.headers.get('Cookie'));
  const user = await getSessionUser(env.DB, cookies[VIEWER_SESSION_COOKIE]);
  if (!user) return errorResponse('Sign in to claim a channel.', 401);

  const { allowed } = await checkRateLimit(env.DB, `channel-claim:${user.id}`, MAX_CLAIMS_PER_WINDOW);
  if (!allowed) return errorResponse('Too many claim requests. Please try again later.', 429);

  const body = await readJsonBody(request);
  const channelId = body?.channelId;
  if (!channelId) return errorResponse('channelId is required.', 400);

  const channel = await env.DB.prepare(`SELECT id, submitted_by_user_id FROM channels WHERE id = ?`).bind(channelId).first();
  if (!channel) return errorResponse('Channel not found.', 404);
  if (channel.submitted_by_user_id) return errorResponse('This channel already has an owner.', 409);

  if (await hasPendingClaim(env.DB, channelId, user.id)) {
    return errorResponse('You already have a pending claim on this channel.', 409);
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : null;
  const id = await createChannelClaim(env.DB, channelId, user.id, message);

  return json({ ok: true, id });
}
