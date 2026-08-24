// Deterministic relevance scoring — no AI/LLM call in v1, per product decision.
// Pure function, no I/O, hand-testable. `classifyVideo()` is the pipeline entry
// point shared/sync.js calls; it wraps scoreVideo() today and is where a future
// AI classification step would slot in without a schema change (videos table
// already reserves ai_confidence_score / ai_labels columns for that).

import { LOCATION_KEYWORDS, REGION_KEYWORDS, CATEGORY_KEYWORDS, STOPLIST_KEYWORDS, RELEVANCE_THRESHOLDS } from './constants.js';

function textIncludesAny(haystack, needles) {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

// Exported for reuse outside scoring too — e.g. inferring a channel's own
// location/category from its name/description for the sync fallback (see
// shared/sync.js), or one-off backfills against already-stored text.
export function matchLocation(text) {
  for (const [location, keywords] of Object.entries(LOCATION_KEYWORDS)) {
    if (textIncludesAny(text, keywords)) return location;
  }
  if (textIncludesAny(text, REGION_KEYWORDS)) return 'region'; // matched, but not a specific town
  return null;
}

export function matchCategory(text) {
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (textIncludesAny(text, keywords)) return slug;
  }
  return null;
}

function daysBetween(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

/**
 * @param {object} meta - { title, description, tags: string[], publishedAt }
 * @param {object} ctx  - { source: 'channel_poll'|'keyword_search'|'manual', channelApproved: boolean }
 * @returns {{ score: number, location: string|null, category: string|null }}
 */
export function scoreVideo(meta, ctx) {
  const title = meta.title || '';
  const description = meta.description || '';
  const tagsText = (meta.tags || []).join(' ');

  let score = 0;

  if (ctx.source === 'channel_poll' && ctx.channelApproved) {
    score += 50; // trust bonus: an admin already vetted this channel
  }

  const titleLocation = matchLocation(title);
  const descLocation = matchLocation(description);
  const tagsLocation = matchLocation(tagsText);
  const location = titleLocation && titleLocation !== 'region' ? titleLocation
    : descLocation && descLocation !== 'region' ? descLocation
    : tagsLocation && tagsLocation !== 'region' ? tagsLocation
    : titleLocation || descLocation || tagsLocation || null;

  if (titleLocation) score += 25;
  if (descLocation) score += 15;
  if (tagsLocation) score += 10;

  const titleCategory = matchCategory(title);
  const descCategory = matchCategory(description);
  const tagsCategory = matchCategory(tagsText);
  const category = titleCategory || descCategory || tagsCategory || null;

  if (titleCategory) score += 15;
  if (descCategory) score += 10;
  if (tagsCategory) score += 10;

  const combined = `${title} ${description}`;
  if (textIncludesAny(combined, STOPLIST_KEYWORDS)) score -= 30;

  const age = daysBetween(meta.publishedAt);
  if (age <= 90) score += 10;
  else if (age < 730) score += Math.max(0, Math.round(10 * (1 - age / 730)));

  score = Math.max(0, Math.min(100, score));

  return { score, location: location === 'region' ? null : location, category };
}

/**
 * Pipeline entry point. Returns the same shape as scoreVideo() plus a decided
 * `status` for the videos table, based on per-source thresholds.
 */
export function classifyVideo(meta, ctx) {
  const { score, location, category } = scoreVideo(meta, ctx);
  const thresholds = RELEVANCE_THRESHOLDS[ctx.source] || RELEVANCE_THRESHOLDS.keyword_search;

  let status;
  if (score >= thresholds.autoPublish) status = 'published';
  else if (score >= thresholds.review) status = 'pending_review';
  else status = 'rejected';

  return { score, location, category, status };
}
