// Sync orchestration — the heart of "YouTube → scheduled job → D1 → frontend".
// No page load in the frontend ever reaches this module or the YouTube API
// directly; only worker-sync's cron handler and admin on-demand-sync/manual-add
// routes call in here. Plain JS, takes `env` (anything exposing DB + YOUTUBE_API_KEY)
// so it works unmodified from a Worker, a Pages Function, or a future backend.

import * as db from './db.js';
import * as yt from './youtube.js';
import { classifyVideo } from './relevance.js';
import { QUOTA, LOCATIONS } from './constants.js';

export async function runChannelPollSync(env) {
  const runId = await db.startSyncRun(env.DB, 'channel_poll');
  const stats = { channelsChecked: 0, videosFound: 0, videosPublished: 0, videosQueuedReview: 0, videosRejected: 0, quotaUnitsUsed: 0 };

  try {
    const quota = await db.getTodayQuotaUsage(env.DB);
    let budget = QUOTA.dailySoftCapUnits - quota.units_used;

    if (budget <= 0) {
      await db.finishSyncRun(env.DB, runId, { ...stats, status: 'partial', errorMessage: 'Daily quota soft cap already reached' });
      return { runId, stats };
    }

    const channels = await db.getChannelsDueForPoll(env.DB, QUOTA.maxChannelsPerRun);
    let subrequestsUsed = 0;

    for (const channel of channels) {
      if (budget <= 0) break;
      // Cloudflare's per-invocation fetch() subrequest cap (see constants.js) —
      // stop cleanly rather than risk the run dying mid-channel. Unpolled
      // channels simply get priority next run (oldest last_checked_at first).
      if (subrequestsUsed >= QUOTA.maxSubrequestsPerRun) {
        await db.recordSyncError(env.DB, runId, 'channel', null, `Stopped early: subrequest budget (${QUOTA.maxSubrequestsPerRun}) reached with ${channels.length - stats.channelsChecked} channels left unpolled this run.`);
        break;
      }
      let unitsThisChannel = 0;

      try {
        let playlistId = channel.uploads_playlist_id;

        if (!playlistId) {
          const { data, unitsUsed } = await yt.getChannel(env.YOUTUBE_API_KEY, { type: 'id', value: channel.youtube_channel_id });
          unitsThisChannel += unitsUsed;
          if (!data) {
            await db.recordSyncError(env.DB, runId, 'channel', channel.id, 'Channel not found on YouTube (deleted, private, or invalid ID)');
            await db.markChannelChecked(env.DB, channel.id);
            await db.addQuotaUsage(env.DB, unitsThisChannel, false);
            budget -= unitsThisChannel;
            continue;
          }
          playlistId = data.uploadsPlaylistId;
          await db.setChannelUploadsPlaylistId(env.DB, channel.id, playlistId);
        }

        const { data: newItems, unitsUsed: listUnits } = await yt.listNewPlaylistItems(
          env.YOUTUBE_API_KEY,
          playlistId,
          channel.last_video_published_at
        );
        unitsThisChannel += listUnits;
        stats.channelsChecked += 1;

        let newestPublished = channel.last_video_published_at;

        if (newItems.length) {
          const { data: fullVideos, unitsUsed: videosUnits } = await yt.listVideosByIds(
            env.YOUTUBE_API_KEY,
            newItems.map((i) => i.youtubeVideoId)
          );
          unitsThisChannel += videosUnits;

          for (const v of fullVideos) {
            stats.videosFound += 1;
            if (await db.videoExists(env.DB, v.youtubeVideoId)) continue;

            const { score, location, category, status } = classifyVideo(v, { source: 'channel_poll', channelApproved: true });

            await db.insertVideo(env.DB, {
              youtubeVideoId: v.youtubeVideoId,
              youtubeChannelId: channel.youtube_channel_id,
              title: v.title,
              description: v.description,
              thumbnailUrl: v.thumbnailUrl,
              channelName: channel.channel_name,
              channelHandle: channel.channel_handle,
              publishedAt: v.publishedAt,
              category: category || channel.category,
              location: location || channel.location,
              tags: v.tags,
              durationSeconds: v.durationSeconds,
              viewCount: v.viewCount,
              likeCount: v.likeCount,
              relevanceScore: score,
              status,
              source: 'channel_poll',
            });

            if (status === 'published') stats.videosPublished += 1;
            else if (status === 'pending_review') stats.videosQueuedReview += 1;
            else stats.videosRejected += 1;

            if (!newestPublished || v.publishedAt > newestPublished) newestPublished = v.publishedAt;
          }
        }

        await db.markChannelChecked(env.DB, channel.id, newestPublished);
      } catch (err) {
        await db.recordSyncError(env.DB, runId, 'channel', channel.id, err.message || String(err));

        // Google's real quota is exhausted (distinct from our own soft-cap
        // check above, which only estimates usage from *our* counters) —
        // every remaining call would fail too, so stop now rather than
        // burning the rest of the batch on doomed requests.
        if (err.youtubeReason === 'quotaExceeded' || err.status === 403) {
          await db.addQuotaUsage(env.DB, unitsThisChannel, false);
          stats.quotaUnitsUsed += unitsThisChannel;
          await db.recordSyncError(env.DB, runId, 'channel', null, 'Stopped early: YouTube reported quota exceeded.');
          break;
        }
      }

      await db.addQuotaUsage(env.DB, unitsThisChannel, false);
      stats.quotaUnitsUsed += unitsThisChannel;
      budget -= unitsThisChannel;
      // channel_poll never calls search.list, so unitsUsed here is exactly
      // the fetch() subrequest count (channels.list/playlistItems/videos.list
      // all cost 1 unit == 1 subrequest each) — safe to reuse as the budget.
      subrequestsUsed += unitsThisChannel;
    }

    await db.finishSyncRun(env.DB, runId, { ...stats, status: stats.channelsChecked < channels.length ? 'partial' : 'success' });
    return { runId, stats };
  } catch (err) {
    await db.finishSyncRun(env.DB, runId, { ...stats, status: 'failed', errorMessage: err.message || String(err) });
    throw err;
  }
}

export async function runKeywordDiscoverySync(env) {
  const runId = await db.startSyncRun(env.DB, 'keyword_search');
  const stats = { channelsChecked: 0, videosFound: 0, videosPublished: 0, videosQueuedReview: 0, videosRejected: 0, quotaUnitsUsed: 0 };

  try {
    const quota = await db.getTodayQuotaUsage(env.DB);
    let budget = QUOTA.dailySoftCapUnits - quota.units_used;
    let searchCallsLeft = QUOTA.maxSearchCallsPerDay - quota.search_calls_used;
    const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const location of LOCATIONS) {
      if (searchCallsLeft <= 0 || budget < 100) break;

      try {
        const { data: videoIds, unitsUsed: searchUnits } = await yt.searchVideos(env.YOUTUBE_API_KEY, `${location} Darjeeling hills`, {
          publishedAfter,
          maxResults: 15,
        });
        budget -= searchUnits;
        searchCallsLeft -= 1;
        stats.quotaUnitsUsed += searchUnits;
        await db.addQuotaUsage(env.DB, searchUnits, true);

        const newIds = [];
        for (const id of videoIds) {
          if (!(await db.videoExists(env.DB, id))) newIds.push(id);
        }
        if (!newIds.length) continue;

        const { data: fullVideos, unitsUsed: videosUnits } = await yt.listVideosByIds(env.YOUTUBE_API_KEY, newIds);
        budget -= videosUnits;
        stats.quotaUnitsUsed += videosUnits;
        await db.addQuotaUsage(env.DB, videosUnits, false);

        for (const v of fullVideos) {
          stats.videosFound += 1;
          const { score, location: matchedLocation, category, status } = classifyVideo(v, { source: 'keyword_search', channelApproved: false });

          await db.insertVideo(env.DB, {
            youtubeVideoId: v.youtubeVideoId,
            youtubeChannelId: v.channelId,
            title: v.title,
            description: v.description,
            thumbnailUrl: v.thumbnailUrl,
            channelName: v.channelTitle,
            channelHandle: null,
            publishedAt: v.publishedAt,
            category,
            location: matchedLocation || location,
            tags: v.tags,
            durationSeconds: v.durationSeconds,
            viewCount: v.viewCount,
            likeCount: v.likeCount,
            relevanceScore: score,
            status,
            source: 'keyword_search',
          });

          if (status === 'published') stats.videosPublished += 1;
          else if (status === 'pending_review') stats.videosQueuedReview += 1;
          else stats.videosRejected += 1;
        }
      } catch (err) {
        await db.recordSyncError(env.DB, runId, 'search_query', location, err.message || String(err));
      }
    }

    await db.finishSyncRun(env.DB, runId, { ...stats, status: 'success' });
    return { runId, stats };
  } catch (err) {
    await db.finishSyncRun(env.DB, runId, { ...stats, status: 'failed', errorMessage: err.message || String(err) });
    throw err;
  }
}

// Admin "manual add by URL/ID" — bypasses relevance scoring (an admin adding
// it by hand is itself the approval signal) but still goes through the same
// dedup + metadata pipeline as automated discovery.
export async function addVideoManually(env, youtubeVideoIdOrUrl, overrides = {}) {
  const idMatch = youtubeVideoIdOrUrl.match(/(?:v=|youtu\.be\/|^)([\w-]{11})/);
  const youtubeVideoId = idMatch ? idMatch[1] : youtubeVideoIdOrUrl;

  if (await db.videoExists(env.DB, youtubeVideoId)) {
    throw new Error('This video has already been added.');
  }

  const { data } = await yt.listVideosByIds(env.YOUTUBE_API_KEY, [youtubeVideoId]);
  const video = data[0];
  if (!video) throw new Error('Video not found on YouTube (deleted, private, or invalid ID).');

  await db.insertVideo(env.DB, {
    youtubeVideoId: video.youtubeVideoId,
    youtubeChannelId: video.channelId,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    channelName: video.channelTitle,
    channelHandle: null,
    publishedAt: video.publishedAt,
    category: overrides.category || null,
    location: overrides.location || null,
    tags: video.tags,
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    relevanceScore: null,
    status: 'published',
    source: 'manual',
  });

  return video;
}

// Admin "approve channel" — resolves the channel on YouTube (confirms it's
// real, fetches its uploads playlist) before flipping it to approved +
// monitored. Throws if the channel can't be resolved, so the admin UI can
// surface a clear error instead of silently approving a dead reference.
export async function resolveChannelForApproval(env, youtubeChannelIdOrUrlOrHandle) {
  const ref = yt.parseChannelReference(youtubeChannelIdOrUrlOrHandle);
  const { data } = await yt.getChannel(env.YOUTUBE_API_KEY, ref);
  if (!data) throw new Error('Channel not found on YouTube — check the URL/handle and try again.');
  return data;
}
