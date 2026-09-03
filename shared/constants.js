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

// English keywords alone miss almost everything — most of this region's real
// content is titled/described in Nepali (Devanagari script), which shares no
// substring with any English word here, so matchCategory() silently returned
// null for it and every such video fell back to shared/sync.js's per-channel
// default category instead of its own actual topic (confirmed: a channel
// posting festival announcements, music releases, school events, and a real
// news story were all lumped under "news" this way). Devanagari terms below
// are a first pass, not an exhaustive/native-speaker-reviewed list — worth
// refining further, but they cover the common cases seen in practice.
export const CATEGORY_KEYWORDS = {
  news: [
    'news', 'breaking', 'headlines', 'bulletin', 'report',
    'समाचार', 'खबर', 'घोटाला', 'छानबिन', 'राजनीतिक', 'राजनीति', 'बयान', 'मुख्यमन्त्री', 'दुर्घटना', 'मृत्यु',
  ],
  vlogs: ['vlog', 'vlogging', 'daily life', 'day in my life', 'भ्लग'],
  travel: ['travel', 'trip', 'tourism', 'tourist', 'trek', 'hiking', 'homestay', 'sightseeing', 'यात्रा', 'घुम्न', 'पर्यटन'],
  food: ['food', 'recipe', 'cooking', 'street food', 'restaurant', 'momo', 'thukpa', 'cuisine', 'खाना', 'परिकार', 'खानपान'],
  culture: ['culture', 'festival', 'tradition', 'heritage', 'dashain', 'tihar', 'losar', 'folk', 'संस्कृति', 'चाड', 'चाडपर्व', 'परम्परा', 'दशैं', 'तिहार', 'लोसार', 'जन्माष्टमी'],
  // 'गीत' (bare "song") deliberately excluded — it's a substring of unrelated
  // words like 'रङ्गीत' (the Rangeet river), which produced a real false
  // match (a drowning-death story got tagged "music"). 'संगीत'/'गायक' are
  // long enough to be safe.
  music: ['song', 'music video', 'singer', 'album', 'lyrics', 'nepali song', 'gorkha song', 'संगीत', 'गायक', 'गायिका'],
  interviews: ['interview', 'conversation with', 'in talk with', 'q&a', 'अन्तर्वार्ता'],
  entertainment: ['comedy', 'entertainment', 'drama', 'short film', 'skit', 'मनोरञ्जन', 'हास्य', 'नाटक'],
  // Bare 'खेल' (game/sport) deliberately excluded — it's a substring of
  // 'खेलमैदान' ("sports ground"/playground), a generic way to name any open
  // public ground used as an event venue regardless of what the event
  // actually is (a political rally in this case, not sports). 'खेलकुद'
  // (the specific word for "sports" as an activity) doesn't have this problem.
  sports: ['sports', 'football', 'cricket', 'tournament', 'match', 'marathon', 'खेलकुद'],
  events: ['event', 'celebration', 'ceremony', 'rally', 'programme', 'program', 'inauguration', 'कार्यक्रम', 'समारोह', 'आयोजना', 'प्रतियोगिता'],
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

// Every literal top-level path this site serves — a channel slug (see
// functions/[slug].js) must never collide with one of these, and the
// catch-all route itself checks this list as defense-in-depth (some of
// these, like a bare "watch" with no id, wouldn't be caught by any more
// specific route and would otherwise fall through to the slug handler).
export const RESERVED_ROOT_SLUGS = new Set([
  'watch', 'creator', 'category', 'location', 'shorts', 'api',
  'css', 'icons', 'js', 'pages', 'templates',
  'sitemap.xml', 'robots.txt', 'manifest.json', 'sw.js', 'ads.txt',
  'logo-circle.png', 'logo-horizantal.png', '_headers', '_redirects',
]);

export const CHANNEL_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];
export const VIDEO_STATUSES = ['published', 'pending_review', 'rejected', 'removed'];

// Cookie names + session lifetime. Admin and viewer sessions are signed with
// separate secrets (ADMIN_SESSION_SECRET vs SESSION_SECRET) so a leak of one
// cannot forge the other.
export const ADMIN_SESSION_COOKIE = 'gtv_admin_session';
export const VIEWER_SESSION_COOKIE = 'gtv_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const VIEWER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Anonymous per-browser identifier for Shorts personalization signal when the
// viewer isn't signed in — not an auth cookie, just a stable key for
// shorts_affinity rows so watch/like behavior can still bias the feed.
export const ANON_SESSION_COOKIE = 'gtv_anon';
export const ANON_SESSION_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

// Points added to shorts_affinity.score per behavior signal (shared/sync.js-
// style: named constants here, not magic numbers at the call site, so the
// weighting is tunable without touching logic).
export const SHORTS_AFFINITY_WEIGHTS = {
  watched_full: 2,
  liked: 5,
  skipped: -1,
};

// Combines into the /api/shorts ranking formula (functions/api/shorts.js) —
// each term normalized to 0-1 within the current candidate pool before these
// weights are applied. A viewer with no affinity history yet (score 0 on
// every dimension) reduces this to recency+engagement only, which doubles as
// the "reasonable default mix" a brand-new viewer should see.
export const SHORTS_RANKING_WEIGHTS = {
  recency: 0.3,
  engagement: 0.3,
  categoryAffinity: 0.25,
  channelAffinity: 0.15,
};

// Points added to video_affinity.score — regular-video equivalent of
// SHORTS_AFFINITY_WEIGHTS above. Regular videos don't have a "skip" signal
// the way a swipe feed does (opening a watch page is already a deliberate
// choice), so there's no negative weight here.
export const VIDEO_AFFINITY_WEIGHTS = {
  watched_30pct: 2, // first time a viewer's progress on a video crosses 30%
  liked: 5, // added to favourites ("My List")
};

// A viewer's progress on a video must cross this fraction before it counts
// as a genuine "watched" signal for video_affinity — matches the spirit of
// SHORTS_AFFINITY_WEIGHTS.watched_full's 80% bar, just lower since opening a
// long-form video and getting a third of the way through is already a much
// more deliberate action than a Shorts swipe.
export const WATCH_AFFINITY_THRESHOLD = 0.3;
