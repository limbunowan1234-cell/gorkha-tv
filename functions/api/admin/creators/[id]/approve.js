import { json, errorResponse } from '../../../../../shared/http.js';
import { getChannelById, getChannelByYoutubeId, updateChannelStatus, assignUniqueChannelSlug } from '../../../../../shared/db.js';
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

    // A public submission can resolve to a YouTube channel that's already on
    // the platform under a different row (e.g. admin-added earlier, or a
    // second "submit your channel"/claim attempt for the same creator).
    // channels.youtube_channel_id is UNIQUE, so this would otherwise surface
    // as a raw D1 constraint error — catch it here with an actionable
    // message instead, and point at the existing row so the admin knows to
    // reject this duplicate rather than guess what happened.
    const existing = await getChannelByYoutubeId(env.DB, resolved.youtubeChannelId);
    if (existing && existing.id !== params.id) {
      return errorResponse(
        `This channel is already on GorkhaTV as "${existing.channel_name}" (${existing.status}). Reject this duplicate submission instead of approving it.`,
        409
      );
    }

    // Only generate a slug if this channel doesn't already have one — a
    // channel being re-approved (e.g. previously suspended) keeps its
    // existing profile URL rather than getting a new one that would break
    // whatever's already linked to it.
    const slug = channel.slug || (await assignUniqueChannelSlug(env.DB, channel.channel_name, params.id));

    await updateChannelStatus(env.DB, params.id, 'approved', {
      monitoringEnabled: true,
      uploadsPlaylistId: resolved.uploadsPlaylistId,
      youtubeChannelId: resolved.youtubeChannelId,
      // resolveChannelForApproval already fetches this from YouTube — it was
      // previously discarded here, leaving every approved channel's profile
      // picture blank.
      thumbnailUrl: resolved.thumbnailUrl,
      slug,
    });
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err.message || 'Failed to resolve this channel on YouTube.', 400);
  }
}
