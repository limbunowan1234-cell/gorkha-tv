// Thin REST wrappers around YouTube Data API v3. Plain fetch() calls, no SDK
// dependency, so this runs unmodified in a Cloudflare Worker, a Pages
// Function, or (later) any other JS backend.
//
// Every exported call returns { data, unitsUsed } so the caller (shared/sync.js)
// can log exact quota consumption per YouTube's published costs:
//   channels.list = 1, playlistItems.list = 1, videos.list = 1, search.list = 100

import { YOUTUBE_API_BASE } from './constants.js';

async function apiGet(path, params, apiKey) {
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || res.status;
    const err = new Error(`YouTube API ${path} failed: ${reason} — ${body?.error?.message || res.statusText}`);
    err.youtubeReason = reason;
    err.status = res.status;
    throw err;
  }
  return body;
}

// Accepts a channel ID (UC...), an @handle, or a full channel URL and returns
// { type, value } for use with channels.list's id/forHandle/forUsername params.
export function parseChannelReference(input) {
  const raw = input.trim();
  const urlMatch = raw.match(/(?:youtube\.com)\/(channel\/|@|c\/|user\/)?([^/?#\s]+)/i);
  const candidate = urlMatch ? urlMatch[2] : raw.replace(/^@/, '');
  const prefix = urlMatch ? urlMatch[1] : raw.startsWith('@') ? '@' : '';

  if (/^UC[\w-]{22}$/.test(raw)) return { type: 'id', value: raw };
  if (prefix === 'channel/') return { type: 'id', value: candidate };
  if (prefix === '@' || raw.startsWith('@')) return { type: 'handle', value: '@' + candidate.replace(/^@/, '') };
  if (prefix === 'user/') return { type: 'username', value: candidate };
  // 'c/' vanity URLs and bare names aren't resolvable by a single API param —
  // treat as a handle guess first (most modern channels have one), caller
  // should fall back to a search if this doesn't resolve.
  return { type: 'handle', value: '@' + candidate };
}

export async function getChannel(apiKey, ref) {
  const params = { part: 'snippet,contentDetails' };
  if (ref.type === 'id') params.id = ref.value;
  else if (ref.type === 'handle') params.forHandle = ref.value;
  else if (ref.type === 'username') params.forUsername = ref.value;

  const body = await apiGet('channels', params, apiKey);
  const item = body.items?.[0];
  if (!item) return { data: null, unitsUsed: 1 };

  return {
    data: {
      youtubeChannelId: item.id,
      channelName: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
      customUrl: item.snippet.customUrl,
    },
    unitsUsed: 1,
  };
}

// Uploads-playlist items, newest first. Stops paging once it reaches videos
// older than `publishedAfter` (or after `maxPages`) to keep quota cost near 1
// unit for channels with no new uploads since the last poll.
export async function listNewPlaylistItems(apiKey, playlistId, publishedAfter, maxPages = 3) {
  const items = [];
  let pageToken;
  let unitsUsed = 0;
  let pages = 0;

  do {
    const body = await apiGet(
      'playlistItems',
      { part: 'snippet,contentDetails', playlistId, maxResults: 25, pageToken },
      apiKey
    );
    unitsUsed += 1;
    pages += 1;

    for (const item of body.items || []) {
      const publishedAt = item.contentDetails.videoPublishedAt || item.snippet.publishedAt;
      if (publishedAfter && publishedAt <= publishedAfter) {
        return { data: items, unitsUsed }; // reached already-seen territory
      }
      items.push({
        youtubeVideoId: item.contentDetails.videoId,
        title: item.snippet.title,
        publishedAt,
      });
    }

    pageToken = body.nextPageToken;
  } while (pageToken && pages < maxPages);

  return { data: items, unitsUsed };
}

// Batched full metadata lookup (videos.list allows up to 50 IDs per call).
export async function listVideosByIds(apiKey, videoIds) {
  const results = [];
  let unitsUsed = 0;

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const body = await apiGet(
      'videos',
      { part: 'snippet,contentDetails,statistics', id: batch.join(',') },
      apiKey
    );
    unitsUsed += 1;

    for (const item of body.items || []) {
      results.push({
        youtubeVideoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnailUrl:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url,
        publishedAt: item.snippet.publishedAt,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        tags: item.snippet.tags || [],
        durationSeconds: parseIso8601Duration(item.contentDetails.duration),
        viewCount: Number(item.statistics?.viewCount || 0),
        likeCount: item.statistics?.likeCount != null ? Number(item.statistics.likeCount) : null,
      });
    }
  }

  return { data: results, unitsUsed };
}

// search.list is the expensive discovery call (100 units) — used sparingly,
// once/day per target location, capped by shared/constants.js QUOTA.
export async function searchVideos(apiKey, query, { publishedAfter, maxResults = 15 } = {}) {
  const body = await apiGet(
    'search',
    {
      part: 'snippet',
      q: query,
      type: 'video',
      order: 'date',
      maxResults,
      publishedAfter,
      relevanceLanguage: 'en',
    },
    apiKey
  );

  const videoIds = (body.items || []).map((item) => item.id.videoId).filter(Boolean);
  return { data: videoIds, unitsUsed: 100 };
}

// Top-level comments only (not nested replies — keeps the Shorts comments
// drawer simple, matching the "don't over-engineer" scope of that feature).
// Cheap: 1 unit, same as videos.list. Throws with err.youtubeReason ===
// 'commentsDisabled' when the uploader has turned comments off — the caller
// (functions/api/videos/[id]/comments.js) treats that as a normal, cacheable
// state, not an error.
export async function listCommentThreads(apiKey, videoId, maxResults = 30) {
  const body = await apiGet('commentThreads', { part: 'snippet', videoId, maxResults, order: 'relevance', textFormat: 'plainText' }, apiKey);

  const comments = (body.items || []).map((item) => {
    const c = item.snippet.topLevelComment.snippet;
    return {
      author: c.authorDisplayName,
      authorAvatar: c.authorProfileImageUrl,
      text: c.textDisplay,
      likeCount: c.likeCount,
      publishedAt: c.publishedAt,
    };
  });

  return { data: comments, unitsUsed: 1 };
}

export function parseIso8601Duration(iso) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!match) return null;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}
