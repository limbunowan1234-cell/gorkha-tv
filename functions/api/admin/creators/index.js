import { json, errorResponse, readJsonBody } from '../../../../shared/http.js';
import { resolveChannelForApproval } from '../../../../shared/sync.js';
import { getChannelByYoutubeId, insertChannelSubmission, updateChannelStatus, assignUniqueChannelSlug } from '../../../../shared/db.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const where = status ? 'WHERE status = ?' : '';
  const binds = status ? [status] : [];

  const { results } = await env.DB.prepare(`SELECT * FROM channels ${where} ORDER BY created_at DESC`)
    .bind(...binds)
    .all();
  return json({ channels: results });
}

// Admin "Add channel" — resolves + approves in one step (an admin adding it
// directly is itself the approval signal, unlike the public submit-channel
// flow which always lands in 'pending').
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.YOUTUBE_API_KEY) return errorResponse('YOUTUBE_API_KEY is not configured on this deployment.', 500);

  const body = await readJsonBody(request);
  const channelUrl = body?.channelUrl;
  if (!channelUrl || typeof channelUrl !== 'string') {
    return errorResponse('channelUrl is required.', 400);
  }

  try {
    const resolved = await resolveChannelForApproval(env, channelUrl);

    const existing = await getChannelByYoutubeId(env.DB, resolved.youtubeChannelId);
    if (existing) return errorResponse('This channel has already been added.', 409);

    const id = await insertChannelSubmission(env.DB, {
      youtubeChannelId: resolved.youtubeChannelId,
      channelName: resolved.channelName,
      channelUrl,
      thumbnailUrl: resolved.thumbnailUrl,
      description: resolved.description,
      location: body?.location,
      category: body?.category,
    });
    const slug = await assignUniqueChannelSlug(env.DB, resolved.channelName, id);
    await updateChannelStatus(env.DB, id, 'approved', { monitoringEnabled: true, uploadsPlaylistId: resolved.uploadsPlaylistId, slug });

    return json({ ok: true, channelId: id });
  } catch (err) {
    return errorResponse(err.message || 'Failed to add channel.', 400);
  }
}
