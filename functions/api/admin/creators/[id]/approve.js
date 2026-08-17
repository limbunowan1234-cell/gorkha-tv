import { json, errorResponse } from '../../../../../shared/http.js';
import { getChannelById, updateChannelStatus } from '../../../../../shared/db.js';
import { resolveChannelForApproval } from '../../../../../shared/sync.js';

// Resolves the channel on YouTube (confirms it's real, fetches its uploads
// playlist) before flipping it to approved + monitored, so an admin never
// approves a dead/typo'd reference and silently gets nothing synced.
export async function onRequestPost(context) {
  const { env, params } = context;
  const channel = await getChannelById(env.DB, params.id);
  if (!channel) return errorResponse('Channel not found.', 404);
  if (!env.YOUTUBE_API_KEY) return errorResponse('YOUTUBE_API_KEY is not configured on this deployment.', 500);

  try {
    const reference = channel.youtube_channel_id || channel.channel_url || channel.channel_handle;
    const resolved = await resolveChannelForApproval(env, reference);

    await updateChannelStatus(env.DB, params.id, 'approved', {
      monitoringEnabled: true,
      uploadsPlaylistId: resolved.uploadsPlaylistId,
      youtubeChannelId: resolved.youtubeChannelId,
    });
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err.message || 'Failed to resolve this channel on YouTube.', 400);
  }
}
