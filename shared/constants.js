// Framework-agnostic constants shared by worker-sync, Pages Functions, and (future) any other backend.
// Plain JS module, no Cloudflare-specific imports — keep it that way.

export const LOCATIONS = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri'];

// Keyword variants used by the relevance scorer (shared/relevance.js) to match
// against video/channel title, description and tags. Lowercase; matching is
// done case-insensitively by the scorer.
export const LOCATION_KEYWORDS = {
  Darjeeling: ['darjeeling', 'darjiling', 'darjeeling hills', 'queen of hills'],
  Kalimpong: ['kalimpong'],
  Kurseong: ['kurseong'],
  Mirik: ['mirik'],
  Siliguri: ['siliguri', 'shiliguri'],
};

// Region-wide terms that count as a location match without pinning a specific town
// (used as a lower-weight fallback signal, see shared/relevance.js).
export const REGION_KEYWORDS = ['gorkha', 'gorkhaland', 'gta', 'hill station', 'darjeeling district', 'north bengal'];

export const CATEGORIES = [
  { slug: 'news', label: 'News' },
  { slug: 'vlogs', label: 'Vlogs' },
  { slug: 'travel', label: 'Travel' },
  { slug: 'food', label: 'Food' },
  { slug: 'culture', label: 'Culture' },
  { slug: 'music', label: 'Music' },
  { slug: 'interviews', label: 'Interviews' },
  { slug: 'entertainment', label: 'Entertainment' },
  { slug: 'sports', label: 'Sports' },
  { slug: 'events', label: 'Events' },
];

export const CATEGORY_KEYWORDS = {
  news: ['news', 'breaking', 'headlines', 'bulletin', 'report'],
  vlogs: ['vlog', 'vlogging', 'daily life', 'day in my life'],
  travel: ['travel', 'trip', 'tourism', 'tourist', 'trek', 'hiking', 'homestay', 'sightseeing'],
  food: ['food', 'recipe', 'cooking', 'street food', 'restaurant', 'momo', 'thukpa', 'cuisine'],
  culture: ['culture', 'festival', 'tradition', 'heritage', 'dashain', 'tihar', 'losar', 'folk'],
  music: ['song', 'music video', 'singer', 'album', 'lyrics', 'nepali song', 'gorkha song'],
  interviews: ['interview', 'conversation with', 'in talk with', 'q&a'],
  entertainment: ['comedy', 'entertainment', 'drama', 'short film', 'skit'],
  sports: ['sports', 'football', 'cricket', 'tournament', 'match', 'marathon'],
  events: ['event', 'celebration', 'ceremony', 'rally', 'programme', 'program', 'inauguration'],
};

// Terms that indicate a false-positive match (e.g. unrelated "Darjeeling" brand
// products, other countries' places with similar names) — subtract points.
export const STOPLIST_KEYWORDS = ['darjeeling tea brand review international shipping', 'nepal government official'];

// ── Relevance scoring thresholds — tunable without touching shared/relevance.js ──
export const RELEVANCE_THRESHOLDS = {
  channel_poll: { autoPublish: 70, review: 40 }, // >=70 publish, 40-69 review, <40 reject
  keyword_search: { autoPublish: 85, review: 50 }, // unvetted source needs a much higher bar
};

// ── YouTube Data API v3 quota budget (10,000 units/day on the free tier) ──
// Kept deliberately conservative for a ₹0 MVP — raise maxChannelsPerRun as the
// channel list grows, no other code needs to change.
export const QUOTA = {
  maxChannelsPerRun: 50, // MVP cap: 20-50 approved channels
  maxSearchCallsPerDay: 6, // one keyword search per target location per day
  dailySoftCapUnits: 8000, // stop syncing early rather than risk a hard 403 from Google
  // Cloudflare Workers free tier allows at most 50 outgoing fetch() subrequests
  // per invocation. A channel poll run must stay under that or fail mid-run.
  // Left with headroom below 50 since a partly-through-a-channel abort is fine
  // (that channel just gets picked up again on the next scheduled run, oldest
  // last_checked_at first), but exceeding the hard limit is not.
  maxSubrequestsPerRun: 44,
};

export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export const CHANNEL_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];
export const VIDEO_STATUSES = ['published', 'pending_review', 'rejected', 'removed'];

// Cookie names + session lifetime. Admin and viewer sessions are signed with
// separate secrets (ADMIN_SESSION_SECRET vs SESSION_SECRET) so a leak of one
// cannot forge the other.
export const ADMIN_SESSION_COOKIE = 'gtv_admin_session';
export const VIEWER_SESSION_COOKIE = 'gtv_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const VIEWER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
