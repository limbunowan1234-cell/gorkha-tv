import { apiFetch, ytThumb, watchUrl, categoryUrl, escapeHtml, videoCardHTML, numberedCardHTML, continueWatchingCardHTML, creatorCardHTML } from './api.js';
import { initAuthNav } from './auth.js';

const LOCATION_EMOJI = { Darjeeling: '🏔️', Kalimpong: '🌄', Kurseong: '🌿', Mirik: '🌸', Siliguri: '🏙️' };
const CATEGORY_EMOJI = { news: '📰', vlogs: '🎥', travel: '🌍', food: '🍜', culture: '🎭', music: '🎵', interviews: '🎤', entertainment: '🎬', sports: '⚽', events: '🎉' };
const LOCATIONS = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri'];

let heroItems = [];
let heroIndex = 0;
let heroTimer = null;

function initApp() {
  loadHome();
  initCategoryPills();
  initSearch();
  initAuthNav();
  initHeroSwipe();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

async function loadHome() {
  try {
    const data = await apiFetch('/home');
    heroItems = data.hero || [];

    renderHero();
    startHeroTimer();
    renderRowCards('trending-row', data.trending, { hideIfEmpty: true, hideWrap: true });
    renderRowCards('latest-row', data.latest);
    renderLocationRows(data.byLocation || {});
    renderCategoryRows(data.byCategory || {});
    renderCreatorRow(data.featuredCreators || []);

    if (data.error) console.warn('[home] partial data:', data.error);
  } catch (err) {
    console.error('Failed to load homepage:', err);
    document.querySelectorAll('.cards-scroll').forEach((el) => {
      el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:8px 0;">Couldn't load content right now — please try again shortly.</div>`;
    });
  }

  loadPersonalizedRows();
}

// Separate request from /api/home on purpose — this data is per-viewer and
// must never be cached at a shared/edge layer (see functions/api/home/personalized.js).
// Its own independent try/catch so a failure here never takes down the rest
// of a homepage that already rendered successfully.
async function loadPersonalizedRows() {
  try {
    const { continueWatching, becauseYouLiked } = await apiFetch('/home/personalized');
    renderRowCards('continue-watching-row', continueWatching, { hideIfEmpty: true, cardFn: continueWatchingCardHTML });

    const likedSection = document.getElementById('because-you-liked-section');
    if (becauseYouLiked && becauseYouLiked.items.length) {
      document.getElementById('because-you-liked-title').textContent = `✨ ${becauseYouLiked.label}`;
      likedSection.style.display = '';
      document.getElementById('because-you-liked-row').innerHTML = becauseYouLiked.items.map(videoCardHTML).join('');
    } else {
      likedSection.style.display = 'none';
    }
  } catch {
    // Cold start / not signed in / transient failure — both rows just stay
    // hidden, exactly like a viewer with no history yet would see.
  }
}

// The hero banner is by far the largest image on the site, so the stored
// thumbnail_url (YouTube's "high" quality, 480x360 — fine for a small card)
// looks visibly blurry stretched across it. Try YouTube's 1280x720
// maxresdefault first and fall back to the normal thumbnail if that specific
// video doesn't have one. A real video missing a maxres variant 404s
// cleanly, but YouTube's CDN can also serve a 200 OK 120x90 grey
// placeholder instead of erroring (confirmed directly) — the naturalWidth
// check below catches that case too, not just onerror.
function setHeroBackground(bg, item) {
  const fallback = () => {
    bg.style.backgroundImage = `url(${ytThumb(item)})`;
  };
  if (!item.youtube_video_id) return fallback();

  const maxres = new Image();
  maxres.onload = () => {
    if (maxres.naturalWidth > 120) bg.style.backgroundImage = `url(${maxres.src})`;
    else fallback();
  };
  maxres.onerror = fallback;
  maxres.src = `https://img.youtube.com/vi/${item.youtube_video_id}/maxresdefault.jpg`;
}

function renderHero() {
  if (!heroItems.length) return;
  const item = heroItems[heroIndex];
  const bg = document.getElementById('hero-bg');
  if (bg) setHeroBackground(bg, item);

  const tag = document.getElementById('hero-tag');
  const title = document.getElementById('hero-title');
  const desc = document.getElementById('hero-desc');
  const metaEl = document.getElementById('hero-meta');

  if (tag) tag.textContent = item.category || 'Featured';
  if (title) title.textContent = item.title || '';
  if (desc) desc.textContent = item.description || '';

  const meta = [];
  if (item.published_at) meta.push(`<span>${new Date(item.published_at).getFullYear()}</span>`);
  if (item.channel_name) meta.push(`<div class="dot"></div><span>${escapeHtml(item.channel_name)}</span>`);
  if (item.location) meta.push(`<div class="dot"></div><span class="lang-badge">${escapeHtml(item.location)}</span>`);
  if (metaEl) metaEl.innerHTML = meta.join('');

  const playBtn = document.getElementById('hero-play-btn');
  const moreBtn = document.getElementById('hero-more-btn');
  if (playBtn) playBtn.onclick = () => (window.location.href = watchUrl(item));
  if (moreBtn) moreBtn.onclick = () => (window.location.href = watchUrl(item));

  const dotsEl = document.getElementById('hero-dots');
  if (dotsEl) {
    dotsEl.innerHTML = heroItems
      .map((_, i) => `<div onclick="window.__gtvGoHero(${i})" style="width:${i === heroIndex ? '24' : '8'}px;height:8px;border-radius:4px;background:${i === heroIndex ? 'var(--red)' : 'rgba(255,255,255,0.25)'};cursor:pointer;transition:all 0.3s;"></div>`)
      .join('');
  }
}

window.__gtvGoHero = (i) => {
  heroIndex = i;
  renderHero();
  clearInterval(heroTimer);
  startHeroTimer();
};

function startHeroTimer() {
  if (heroItems.length <= 1) return;
  heroTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % heroItems.length;
    renderHero();
  }, 7000);
}

// Swipe left/right to move through the hero — dots/timer alone aren't
// enough on touch devices where there's no hover/click affordance for "next".
function initHeroSwipe() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  let startX = 0;
  let startY = 0;

  hero.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  hero.addEventListener('touchend', (e) => {
    if (heroItems.length <= 1) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return; // too short, or more vertical than horizontal — not a swipe

    heroIndex = dx < 0 ? (heroIndex + 1) % heroItems.length : (heroIndex - 1 + heroItems.length) % heroItems.length;
    renderHero();
    clearInterval(heroTimer);
    startHeroTimer();
  }, { passive: true });
}

function renderRowCards(id, items, opts = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const items_ = items || [];
  if (opts.hideIfEmpty) {
    const rowWrap = el.closest('.row');
    if (rowWrap) rowWrap.style.display = items_.length ? '' : 'none';
  }
  if (!items_.length) {
    el.innerHTML = opts.hideIfEmpty ? '' : `<div style="color:var(--muted);font-size:13px;padding:8px 0;">No content yet.</div>`;
    return;
  }
  el.innerHTML = items_.map(opts.cardFn || videoCardHTML).join('');
}

function renderLocationRows(byLocation) {
  const wrap = document.getElementById('location-rows');
  if (!wrap) return;
  const rows = LOCATIONS.filter((loc) => (byLocation[loc] || []).length).map((loc) => ({
    title: `${LOCATION_EMOJI[loc] || ''} Top 10 ${loc}`,
    link: `/location/${encodeURIComponent(loc)}`,
    items: byLocation[loc],
  }));
  wrap.innerHTML = rows.map((row, i) => rowHTML(`loc-row-${i}`, row)).join('');
  rows.forEach((row, i) => {
    // Netflix-style numbered treatment — these rows are genuinely ranked
    // (see functions/api/home.js), so the giant rank number is honest, not
    // just decorative.
    document.getElementById(`loc-row-${i}`).innerHTML = row.items.map((v, idx) => numberedCardHTML(v, idx + 1)).join('');
  });
}

function renderCategoryRows(byCategory) {
  const wrap = document.getElementById('category-rows');
  if (!wrap) return;
  const rows = Object.entries(byCategory)
    .filter(([, items]) => items.length)
    .map(([slug, items]) => {
      const label = slug.charAt(0).toUpperCase() + slug.slice(1);
      return {
        // News stays a plain latest-by-date row (time-sensitive), not a "Top 10" —
        // every other category row is now genuinely engagement-ranked, see functions/api/home.js.
        title: slug === 'news' ? `${CATEGORY_EMOJI[slug] || ''} ${label}` : `${CATEGORY_EMOJI[slug] || ''} Top 10 ${label}`,
        link: categoryUrl(slug),
        items,
        numbered: slug !== 'news',
      };
    });
  wrap.innerHTML = rows.map((row, i) => rowHTML(`cat-row-${i}`, row)).join('');
  rows.forEach((row, i) => {
    document.getElementById(`cat-row-${i}`).innerHTML = row.numbered
      ? row.items.map((v, idx) => numberedCardHTML(v, idx + 1)).join('')
      : row.items.map(videoCardHTML).join('');
  });
}

function renderCreatorRow(creators) {
  const section = document.getElementById('creators-row-section');
  const el = document.getElementById('creators-row');
  if (!section || !el) return;
  if (!creators.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  el.innerHTML = creators.map(creatorCardHTML).join('');
}

function rowHTML(id, row) {
  return `
    <div class="row">
      <div class="row-header">
        <h2 class="row-title">${row.title}</h2>
        <a href="${row.link}" class="see-all">See all →</a>
      </div>
      <div class="cards-scroll" id="${id}"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;
}

function initCategoryPills() {
  const bar = document.getElementById('cats-bar');
  if (!bar) return;
  apiFetch('/categories')
    .then(({ categories }) => {
      const pills = [{ slug: '', label: 'All' }, ...categories.map((c) => ({ slug: c.slug, label: c.label }))];
      bar.innerHTML = pills.map((p) => `<div class="cat-pill ${p.slug === '' ? 'active' : ''}" data-slug="${p.slug}">${escapeHtml(p.label)}</div>`).join('');
    })
    .catch(() => {
      bar.innerHTML = '';
    });

  bar.addEventListener('click', (e) => {
    const pill = e.target.closest('.cat-pill');
    if (!pill) return;
    const slug = pill.dataset.slug;
    window.location.href = slug ? categoryUrl(slug) : '/';
  });
}

function initSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      window.location.href = q ? `/pages/search.html?q=${encodeURIComponent(q)}` : '/pages/search.html';
    }
  });
}
