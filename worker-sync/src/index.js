// Standalone Cloudflare Worker — the only piece of this stack that runs on a
// schedule (Cloudflare Pages Functions have no Cron Trigger support). Its only
// job is to call into shared/sync.js at the right cadence and let D1 hold the
// result; the frontend and Pages Functions never call the YouTube API directly.
//
// Local test without waiting for real cron: `npm run worker:dev` (uses
// `wrangler dev --test-scheduled`, then hit http://localhost:8787/__scheduled?cron=...`).

import { runChannelPollSync, runKeywordDiscoverySync } from '../../shared/sync.js';

const CHANNEL_POLL_CRON = '0 */6 * * *';
const KEYWORD_DISCOVERY_CRON = '30 2 * * *';

export default {
  async scheduled(event, env, ctx) {
    if (!env.YOUTUBE_API_KEY) {
      console.error('YOUTUBE_API_KEY is not set — skipping sync run.');
      return;
    }

    if (event.cron === KEYWORD_DISCOVERY_CRON) {
      ctx.waitUntil(runKeywordDiscoverySync(env).catch((err) => console.error('Keyword discovery sync failed:', err)));
    } else {
      // Default to channel poll for any other trigger (including the
      // 6-hourly cron and manual `wrangler dev --test-scheduled` runs).
      ctx.waitUntil(runChannelPollSync(env).catch((err) => console.error('Channel poll sync failed:', err)));
    }
  },

  async fetch() {
    return new Response('gorkhatv-sync worker is running. This endpoint has no public API — sync is cron-triggered only.', {
      status: 200,
    });
  },
};
