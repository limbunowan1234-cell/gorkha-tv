import { json, cacheableJson, errorResponse } from '../../../../shared/http.js';
import { findRelatedVideos } from '../../../../shared/related-videos.js';

// Ranking lives in shared/related-videos.js (also used by the watch page's
// server render) — see there for how "related" is defined.

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const video = await env.DB.prepare(
      `SELECT youtube_channel_id, category, location FROM videos WHERE youtube_video_id = ? AND status = 'published'`
    )
      .bind(params.id)
      .first();
    if (!video) return json({ related: [] });

    const related = await findRelatedVideos(env.DB, params.id, video);

    return cacheableJson({ related });
  } catch (err) {
    return errorResponse('Related videos are temporarily unavailable.', 503);
  }
}
