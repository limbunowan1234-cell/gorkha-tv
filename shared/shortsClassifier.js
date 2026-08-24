// Determines whether a video is a real YouTube Short using YouTube's own
// /shorts/{id} classification signal — the Data API's contentDetails has no
// width/height field, and YouTube's oEmbed endpoint always reports its fixed
// 16:9 player box regardless of the source video's real aspect ratio (both
// verified empirically during the original 2057-video backfill, see
// shared/migrations/005_content_type.sql). Requesting /shorts/{id} and
// checking whether YouTube redirects it away to /watch is the same signal
// that backfill used, just applied per-video at sync time instead of in bulk.
//
// Not a Data API call — no API key, no quota unit — but it IS an extra
// fetch() subrequest, which matters inside a Cloudflare Worker's per-
// invocation subrequest cap (see QUOTA.maxSubrequestsPerRun). The duration
// cutoff below skips that fetch entirely for videos it can already rule out.

// Empirically: 0 of 1118+ videos over 183s in the original backfill were
// ever classified as Shorts (YouTube caps Shorts at 3 minutes) — anything
// longer than this can be marked 'video' with certainty and no network call.
const SHORTS_DURATION_CUTOFF_SECONDS = 200;

export async function classifyContentType(videoId, durationSeconds) {
  if (durationSeconds != null && durationSeconds > SHORTS_DURATION_CUTOFF_SECONDS) {
    return { contentType: 'video', usedFetch: false };
  }

  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, { redirect: 'follow' });
    if (!res.ok) return { contentType: null, usedFetch: true }; // leave unclassified rather than guess — a later admin backfill can fill it in
    return { contentType: res.url.includes('/shorts/') ? 'short' : 'video', usedFetch: true };
  } catch {
    return { contentType: null, usedFetch: true };
  }
}
