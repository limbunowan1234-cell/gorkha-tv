import { json, errorResponse, readJsonBody } from '../../../../shared/http.js';
import { runChannelPollSync, runKeywordDiscoverySync } from '../../../../shared/sync.js';

// Manual on-demand trigger, reusing the exact same pipeline the scheduled
// worker calls — an admin clicking "Sync now" gets identical behavior
// (same quota/subrequest budgets, same logging) to a cron-triggered run.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.YOUTUBE_API_KEY) return errorResponse('YOUTUBE_API_KEY is not configured on this deployment.', 500);

  const body = await readJsonBody(request);
  const type = body?.type === 'keyword_search' ? 'keyword_search' : 'channel_poll';

  try {
    const result =
      type === 'keyword_search' ? await runKeywordDiscoverySync(env) : await runChannelPollSync(env);
    return json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err.message || 'Sync run failed.', 500);
  }
}
