import { apiFetch, escapeHtml, formatCount, watchUrl } from './api.js';
import { setQueue } from './queue.js';
import { navigate, registerTeardown } from './router.js';

// Per-product feature blocks for the genre pages: the same personality the
// native apps have. SWARA's waveform hero for the #1 song, CHIMAL's rotating
// cinema hero and Magic row, KHABAR's lead story, bulletin and headline list.
// Styles live in templates/genre.html (page-style).

const CATEGORY_LABEL = { movies: 'Movies', shortfilms: 'Short Films', comedy: 'Comedy', entertainment: 'Entertainment', vlogs: 'Vlogs', magic: 'Magic' };

export function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Fresh means under 6 hours old: that is what earns a BREAKING tag.
export const isFresh = (iso) => !!iso && Date.now() - new Date(iso).getTime() < 6 * 3600 * 1000;

function thumbUrl(v) {
  return v.thumbnail_url || `https://img.youtube.com/vi/${v.youtube_video_id}/hqdefault.jpg`;
}

function bgStyle(v) {
  return `background-image:url('${escapeHtml(thumbUrl(v))}')`;
}

// Plays a list as a queue from the given item, the same mechanism the chart
// and Top 10 cards use, so the up-next countdown walks the list.
export function playList(list, index = 0) {
  setQueue(list, index);
  navigate(watchUrl(list[index], { autoplay: true }));
}

// SWARA: the #1 song as a hero with a moving waveform (the brand's Ridge Wave
// idea: tall in the middle, falling away to the sides).
export function renderWaveHero(chart) {
  const el = document.getElementById('genre-feature');
  if (!el || !chart.length) return;
  const hero = chart[0];
  const envelope = [0.22, 0.32, 0.46, 0.62, 0.8, 0.95, 1, 0.9, 0.74, 0.58, 0.72, 0.84, 0.66, 0.48, 0.34, 0.24];
  const bars = envelope.map((h, i) => `<i style="height:${Math.round(h * 52)}px;animation-delay:${((i % 6) * 0.13).toFixed(2)}s"></i>`).join('');
  el.innerHTML = `
    <div class="feature-hero" id="feature-hero" style="${bgStyle(hero)}">
      <div class="feature-wave" aria-hidden="true">${bars}</div>
      <div class="feature-body">
        <span class="feature-pill">#1 this week</span>
        <div class="feature-title">${escapeHtml(hero.title)}</div>
        <div class="feature-meta">${escapeHtml([hero.channel_name, hero.view_count ? `${formatCount(hero.view_count)} plays` : null].filter(Boolean).join(' · '))}</div>
        <div class="feature-actions"><button class="feature-btn" id="feature-play">▶ Play the chart</button></div>
      </div>
    </div>`;
  document.getElementById('feature-play').addEventListener('click', (e) => {
    e.stopPropagation();
    playList(chart, 0);
  });
  document.getElementById('feature-hero').addEventListener('click', () => playList(chart, 0));
}

// CHIMAL: a hero that rotates through the most-watched titles every 5s.
export function renderCinemaHero(items) {
  const el = document.getElementById('genre-feature');
  if (!el || !items.length) return;
  const picks = items.slice(0, 5);
  let index = 0;
  el.innerHTML = `
    <div class="feature-hero" id="feature-hero">
      <div class="feature-body" id="feature-body"></div>
      <div class="feature-dots" id="feature-dots">${picks.map((_, i) => `<button data-i="${i}" aria-label="Show title ${i + 1}"></button>`).join('')}</div>
    </div>`;
  const hero = document.getElementById('feature-hero');
  const body = document.getElementById('feature-body');
  const dots = [...document.querySelectorAll('#feature-dots button')];

  function show(i) {
    index = i;
    const v = picks[i];
    hero.setAttribute('style', bgStyle(v));
    body.innerHTML = `
      <span class="feature-pill">${escapeHtml(CATEGORY_LABEL[v.category] || v.category || 'CHIMAL')}</span>
      <div class="feature-title">${escapeHtml(v.title)}</div>
      <div class="feature-meta">${escapeHtml([v.channel_name, v.view_count ? `${formatCount(v.view_count)} views` : null].filter(Boolean).join(' · '))}</div>
      <div class="feature-actions"><button class="feature-btn">▶ Watch</button></div>`;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
  }

  hero.addEventListener('click', (e) => {
    const dot = e.target.closest('#feature-dots button');
    if (dot) {
      show(Number(dot.dataset.i));
      return;
    }
    navigate(watchUrl(picks[index], { autoplay: true }));
  });
  show(0);

  if (picks.length > 1) {
    const timer = setInterval(() => show((index + 1) % picks.length), 5000);
    registerTeardown(() => clearInterval(timer));
  }
}

// KHABAR: a lead story (BREAKING when under 6 hours old) and a Play bulletin
// button that runs the headlines back to back.
export function renderNewsFeature(latest) {
  const el = document.getElementById('genre-feature');
  if (!el || !latest.length) return;
  const lead = latest[0];
  el.innerHTML = `
    <div class="feature-hero" id="feature-hero" style="${bgStyle(lead)}">
      <div class="feature-body">
        ${isFresh(lead.published_at) ? '<span class="feature-pill breaking">Breaking</span>' : '<span class="feature-pill">Top story</span>'}
        <div class="feature-title">${escapeHtml(lead.title)}</div>
        <div class="feature-meta">${escapeHtml([lead.channel_name, timeAgo(lead.published_at)].filter(Boolean).join(' · '))}</div>
        <div class="feature-actions">
          <button class="feature-btn" id="feature-bulletin">▶ Play bulletin</button>
          <button class="feature-btn outline" id="feature-read">Watch this story</button>
        </div>
      </div>
    </div>`;
  document.getElementById('feature-bulletin').addEventListener('click', (e) => {
    e.stopPropagation();
    playList(latest, 0);
  });
  document.getElementById('feature-read').addEventListener('click', (e) => {
    e.stopPropagation();
    navigate(watchUrl(lead, { autoplay: true }));
  });
  document.getElementById('feature-hero').addEventListener('click', () => navigate(watchUrl(lead, { autoplay: true })));
}

// KHABAR's headline-first list (replaces the card row): headline leads, then
// source and age, a small picture on the right.
export function newsListHTML(stories) {
  return stories
    .map(
      (v, i) => `
    <a class="news-item" href="${watchUrl(v)}" data-i="${i}">
      <div class="news-text">
        ${isFresh(v.published_at) ? '<span class="news-tag">BREAKING</span>' : ''}
        <div class="news-headline">${escapeHtml(v.title)}</div>
        <div class="news-meta">${escapeHtml([v.channel_name, timeAgo(v.published_at), v.location].filter(Boolean).join(' · '))}</div>
      </div>
      <img class="news-thumb" src="${escapeHtml(thumbUrl(v))}" alt="" loading="lazy">
    </a>`
    )
    .join('');
}

// Magic: long-form magic plus the magic Shorts, newest first (every magic
// upload so far is a Short, and the long-form endpoints exclude Shorts by
// design). Shorts open in the reels page, long-form in the normal player.
export async function fetchMagic(limit = 20) {
  const [long, shorts] = await Promise.all([
    apiFetch(`/videos?category=magic&limit=${limit}`).catch(() => ({ videos: [] })),
    apiFetch(`/shorts?category=magic&limit=${limit}`).catch(() => ({ shorts: [] })),
  ]);
  const seen = new Set();
  return [
    ...(long.videos || []).map((v) => ({ ...v, _href: watchUrl(v) })),
    ...(shorts.shorts || []).map((v) => ({ ...v, _href: `/shorts/${v.youtube_video_id}` })),
  ]
    .filter((v) => !seen.has(v.youtube_video_id) && seen.add(v.youtube_video_id))
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    .slice(0, limit);
}

export function magicCardsHTML(items) {
  return items
    .map(
      (v) => `
    <a class="magic-card" href="${v._href}">
      <div class="magic-thumb"><img src="${escapeHtml(thumbUrl(v))}" alt="" loading="lazy"><div class="magic-title">${escapeHtml(v.title)}</div></div>
    </a>`
    )
    .join('');
}

export async function loadMagicRow() {
  const section = document.getElementById('genre-magic-section');
  const row = document.getElementById('genre-magic-row');
  if (!section || !row) return;
  try {
    const items = await fetchMagic();
    if (!items.length) return;
    section.style.display = '';
    row.innerHTML = magicCardsHTML(items);
  } catch {
    /* a bonus row: stays hidden */
  }
}
