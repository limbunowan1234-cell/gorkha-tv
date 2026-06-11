import { databases, storage, account, DB_ID, COLLECTION_ID, ARTISTS_COLLECTION_ID, CLAIMS_COLLECTION_ID, LIKES_COLLECTION_ID, BUCKET_ID, ADMIN_EMAIL, ID, Query } from './appwrite.js';

// ── Inlined likes helpers (no separate module to avoid load failures) ──
async function getBulkCounts(contentIds) {
  const map = {};
  contentIds.forEach(id => map[id] = { like: 0, share: 0 });
  if (!contentIds.length) return map;
  try {
    const res = await databases.listDocuments(DB_ID, LIKES_COLLECTION_ID, [Query.limit(500)]);
    res.documents.forEach(d => {
      if (map[d.contentId] && (d.type === 'like' || d.type === 'share')) map[d.contentId][d.type] += 1;
    });
  } catch (e) { console.error('getBulkCounts failed (using zeros):', e); }
  return map;
}

async function recordShare(contentId, userId) {
  try {
    await databases.createDocument(DB_ID, LIKES_COLLECTION_ID, ID.unique(), { contentId, userId: userId || 'anon', type: 'share' });
  } catch (e) { console.error('share record failed', e); }
}

async function shareContent(title, url) {
  if (navigator.share) { try { await navigator.share({ title, url }); return true; } catch { return false; } }
  else { try { await navigator.clipboard.writeText(url); return 'copied'; } catch { return false; } }
}

let currentUser = null;
let userArtistProfile = null;   // their artist doc, if any
let userIsVerified = false;     // has 1+ approved claim
let countsMap = {};             // { contentId: { like, share } } real global counts
let allContent = [];      // raw documents
let displayItems = [];    // series-grouped items (one entry per series + singles)
let heroItems = [];
let heroIndex = 0;
let heroTimer = null;
let likes = JSON.parse(localStorage.getItem('gtv_likes') || '{}');
let favourites = JSON.parse(localStorage.getItem('gtv_favs') || '[]');

const VIDEO_PAGE = 'pages/video.html';
const BROWSE_PAGE = 'pages/browse.html';
const PAGES = 'pages/';
const FAV_PAGE = 'pages/my-favourites.html';
const CREDITS_PAGE = 'pages/my-credits.html';
const EDIT_PROFILE_PAGE = 'pages/edit-profile.html';
const ADMIN_PAGE = 'pages/admin.html';

const GOOGLE_REDIRECT = 'https://gorkhatv.site/pages/auth-callback.html';
const GOOGLE_SUCCESS = 'https://gorkhatv.site';

document.addEventListener('DOMContentLoaded', () => {
  // Load content FIRST and independently — never let auth block the page
  loadContent();
  initCategoryPills();
  initSearch();
  // Auth runs separately; if it hangs or fails, content is unaffected
  checkAuth();
});

async function checkAuth() {
  try {
    currentUser = await account.get();
    await loadUserStatus();
    renderUserNav();
  } catch {
    currentUser = null;
    renderLoginBtn();
  }
}

// Check if user has an artist profile and any approved claims
async function loadUserStatus() {
  try {
    const [profileRes, claimsRes] = await Promise.all([
      databases.listDocuments(DB_ID, ARTISTS_COLLECTION_ID, [Query.equal('userId', currentUser.$id), Query.limit(1)]),
      databases.listDocuments(DB_ID, CLAIMS_COLLECTION_ID, [Query.equal('userId', currentUser.$id), Query.equal('status', 'approved'), Query.limit(1)])
    ]);
    userArtistProfile = profileRes.documents[0] || null;
    userIsVerified = claimsRes.documents.length > 0;
  } catch (e) {
    console.error('user status load failed', e);
    userArtistProfile = null;
    userIsVerified = false;
  }
}

function renderUserNav() {
  const nr = document.getElementById('nav-right');
  if (!nr) return;
  const initial = currentUser.name ? currentUser.name[0].toUpperCase() : '?';
  const isAdmin = currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Verified badge (1+ approved claim)
  const verifiedTick = userIsVerified
    ? ` <span class="verified-tick" title="Verified Artist">✓</span>` : '';

  // Smart profile link: create vs view+edit
  let profileLinks = '';
  if (userArtistProfile) {
    profileLinks = `
      <a href="${PAGES}artist.html?id=${encodeURIComponent(userArtistProfile.slug || '')}" class="dropdown-item">👤 View My Profile</a>
      <a href="${EDIT_PROFILE_PAGE}" class="dropdown-item">✏️ Edit Profile</a>`;
  } else {
    profileLinks = `<a href="${EDIT_PROFILE_PAGE}" class="dropdown-item">🎭 Create Artist Profile</a>`;
  }

  nr.innerHTML = `
    <div class="user-menu-wrap">
      <div class="user-avatar ${userIsVerified ? 'verified' : ''}" onclick="toggleDropdown()" title="${currentUser.name}">
        ${currentUser.prefs?.avatar ? `<img src="${currentUser.prefs.avatar}" alt="">` : initial}
      </div>
      <div class="user-dropdown" id="user-dropdown">
        <div class="dropdown-header">
          <div class="name">${currentUser.name}${verifiedTick}</div>
          <div class="email">${currentUser.email}</div>
          ${userIsVerified ? `<div class="verified-label">✓ Verified Artist</div>` : ''}
        </div>
        <a href="${FAV_PAGE}" class="dropdown-item">🔖 My Favourites</a>
        <a href="${CREDITS_PAGE}" class="dropdown-item">⭐ My Credits</a>
        ${profileLinks}
        ${isAdmin ? `<a href="${ADMIN_PAGE}" class="dropdown-item">🛠 Admin Panel</a>` : ''}
        <hr class="dropdown-divider">
        <button onclick="logout()" class="dropdown-item danger">Sign out</button>
      </div>
    </div>
  `;
}

function renderLoginBtn() {
  const nr = document.getElementById('nav-right');
  if (!nr) return;
  nr.innerHTML = `<button class="btn-signin" onclick="loginWithGoogle()">Sign In</button>`;
}

window.toggleDropdown = () => {
  const el = document.getElementById('user-dropdown');
  if (el) el.classList.toggle('open');
};

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.user-menu-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('user-dropdown')?.classList.remove('open');
  }
});

window.loginWithGoogle = async () => {
  try {
    await account.createOAuth2Token('google', GOOGLE_REDIRECT, GOOGLE_SUCCESS);
  } catch (err) {
    console.error('Login error:', err);
  }
};

window.logout = async () => {
  try {
    await account.deleteSession('current');
  } catch {}
  window.location.reload();
};

async function loadContent() {
  try {
    const res = await databases.listDocuments(DB_ID, COLLECTION_ID, [
      Query.equal('status', 'published'),
      Query.orderDesc('publishedAt'),
      Query.limit(100)
    ]);

    allContent = res.documents;
    displayItems = groupBySeries(allContent);

    heroItems = [...displayItems.filter(d => d._featured), ...displayItems].slice(0, 6);
    const seen = new Set();
    heroItems = heroItems.filter(d => {
      if (seen.has(d._key)) return false;
      seen.add(d._key);
      return true;
    }).slice(0, 5);

    renderHero();
    startHeroTimer();
    renderRows();

    getBulkCounts(allContent.map(d => d.$id))
      .then(counts => {
        countsMap = counts;
        displayItems = groupBySeries(allContent);
        renderRows();
      })
      .catch(e => console.error('counts load failed (rows still shown):', e));
  } catch (err) {
    console.error('Load error:', err);
  }
}

/*
 * Group documents by seriesId. Each series collapses into ONE display item
 * that carries: representative episode (first/oldest), episode list, combined
 * like count, newest date (for "Latest"), and a flag for featured.
 * Single videos (no seriesId) pass through as their own display item.
 */
function groupBySeries(docs) {
  const map = {};
  const order = [];
  const items = [];

  docs.forEach(doc => {
    const sid = (doc.seriesId || '').trim();
    if (sid) {
      if (!map[sid]) { map[sid] = []; order.push(sid); }
      map[sid].push(doc);
    } else {
      items.push(makeSingle(doc));
    }
  });

  order.forEach(sid => {
    const eps = map[sid].slice().sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
    const first = eps[0];
    const newest = eps.reduce((acc, e) => new Date(e.publishedAt) > new Date(acc.publishedAt) ? e : acc, eps[0]);
    const totalLikes = eps.reduce((sum, e) => sum + (countsMap[e.$id]?.like || 0), 0);
    const totalShares = eps.reduce((sum, e) => sum + (countsMap[e.$id]?.share || 0), 0);
    items.push({
      _key: 'series:' + sid,
      _isSeries: true,
      _seriesId: sid,
      _episodes: eps,
      _epCount: eps.length,
      _featured: eps.some(e => e.featured),
      _likeCount: totalLikes,
      _shareCount: totalShares,
      _popularity: totalLikes + totalShares,
      _newestDate: newest.publishedAt,
      // representative fields for display = first episode
      $id: first.$id,
      title: first.seriesName || sid,
      category: first.category,
      language: first.language,
      location: first.location,
      description: first.description,
      youtube_id: first.youtube_id,
      thumbnailFileId: first.thumbnailFileId,
      publishedAt: newest.publishedAt,
      seriesName: first.seriesName,
      seriesId: sid
    });
  });

  return items;
}

function makeSingle(doc) {
  const lk = countsMap[doc.$id]?.like || 0;
  const sh = countsMap[doc.$id]?.share || 0;
  return {
    _key: 'single:' + doc.$id,
    _isSeries: false,
    _episodes: [doc],
    _epCount: 1,
    _featured: !!doc.featured,
    _likeCount: lk,
    _shareCount: sh,
    _popularity: lk + sh,
    _newestDate: doc.publishedAt,
    ...doc
  };
}

function videoUrl(item) {
  // Series → open first episode; single → open the video
  const targetId = item._isSeries ? item._episodes[0].$id : item.$id;
  return `${VIDEO_PAGE}?id=${encodeURIComponent(targetId)}`;
}

function browseUrl(cat) {
  return cat && cat !== 'all' ? `${BROWSE_PAGE}?cat=${encodeURIComponent(cat)}` : BROWSE_PAGE;
}

function getThumb(item, size = 'hq') {
  if (item.thumbnailFileId) return storage.getFileView(BUCKET_ID, item.thumbnailFileId);
  if (item.youtube_id) return `https://img.youtube.com/vi/${item.youtube_id}/${size === 'max' ? 'maxresdefault' : 'hqdefault'}.jpg`;
  return '';
}

function renderHero() {
  if (!heroItems.length) return;

  const item = heroItems[heroIndex];
  const thumb = getThumb(item, 'max');
  const bg = document.getElementById('hero-bg');
  if (bg) bg.style.backgroundImage = `url(${thumb})`;

  const tag = document.getElementById('hero-tag');
  const title = document.getElementById('hero-title');
  const desc = document.getElementById('hero-desc');
  const metaEl = document.getElementById('hero-meta');

  if (tag) tag.textContent = item.category || 'Featured';
  if (title) title.textContent = item.title || '';
  if (desc) desc.textContent = item.description || '';

  const meta = [];
  if (item.publishedAt) meta.push(`<span>${new Date(item.publishedAt).getFullYear()}</span>`);
  if (item._isSeries) meta.push(`<div class="dot"></div><span class="lang-badge">${item._epCount} EP${item._epCount > 1 ? 'S' : ''}</span>`);
  if (item.language) meta.push(`<div class="dot"></div><span class="lang-badge">${item.language.slice(0, 3).toUpperCase()}</span>`);
  if (item.location) meta.push(`<div class="dot"></div><span>${item.location}</span>`);
  if (metaEl) metaEl.innerHTML = meta.join('');

  const playBtn = document.getElementById('hero-play-btn');
  const moreBtn = document.getElementById('hero-more-btn');
  if (playBtn) playBtn.onclick = () => window.location.href = videoUrl(item);
  if (moreBtn) moreBtn.onclick = () => window.location.href = videoUrl(item);

  const dotsEl = document.getElementById('hero-dots');
  if (dotsEl) {
    dotsEl.innerHTML = heroItems.map((_, i) =>
      `<div onclick="goHero(${i})" style="width:${i === heroIndex ? '24' : '8'}px;height:8px;border-radius:4px;background:${i === heroIndex ? 'var(--red)' : 'rgba(255,255,255,0.25)'};cursor:pointer;transition:all 0.3s;"></div>`
    ).join('');
  }
}

window.goHero = (i) => {
  heroIndex = i;
  renderHero();
  resetHeroTimer();
};

function startHeroTimer() {
  if (heroItems.length <= 1) return;
  heroTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % heroItems.length;
    renderHero();
  }, 7000);
}

function resetHeroTimer() {
  clearInterval(heroTimer);
  startHeroTimer();
}

function renderRows(category = 'all') {
  const filtered = category === 'all' ? displayItems : displayItems.filter(d => d.category === category);
  const featured = displayItems.filter(d => d._featured).slice(0, 8);
  const latest = filtered.slice().sort((a, b) => new Date(b._newestDate) - new Date(a._newestDate)).slice(0, 12);
  const topLiked = [...displayItems].filter(d => d._popularity > 0).sort((a, b) => b._popularity - a._popularity).slice(0, 5);

  renderRowCards('featured-row', featured);
  renderTopN('topn-row', topLiked);
  renderRowCards('latest-row', latest);

  renderDynamicRows();
}

// Build one row per category that has content, plus one row per genre that has content
function renderDynamicRows() {
  const wrap = document.getElementById('dynamic-rows');
  if (!wrap) return;

  const rows = [];

  // ── Category rows ──
  const catLabels = { movie: 'Movies', webseries: 'Web Series', music: 'Music Videos', documentary: 'Documentaries' };
  Object.entries(catLabels).forEach(([cat, label]) => {
    const items = displayItems.filter(d => d.category === cat)
      .sort((a, b) => new Date(b._newestDate) - new Date(a._newestDate));
    if (items.length) rows.push({ title: label, link: `pages/browse.html?cat=${cat}`, items: items.slice(0, 12) });
  });

  // ── Genre rows ── (genres are comma-separated on each doc)
  const genreMap = {};
  displayItems.forEach(d => {
    (d.genre || '').split(',').map(g => g.trim()).filter(Boolean).forEach(g => {
      const key = g.toLowerCase();
      if (!genreMap[key]) genreMap[key] = { label: g, items: [] };
      genreMap[key].items.push(d);
    });
  });
  // Only genres with 2+ items, sorted by count desc
  Object.values(genreMap)
    .filter(g => g.items.length >= 2)
    .sort((a, b) => b.items.length - a.items.length)
    .forEach(g => {
      const items = g.items.sort((a, b) => new Date(b._newestDate) - new Date(a._newestDate)).slice(0, 12);
      rows.push({ title: g.label, link: `pages/search.html?q=${encodeURIComponent(g.label)}`, items });
    });

  wrap.innerHTML = rows.map((row, i) => `
    <div class="row">
      <div class="row-header">
        <h2 class="row-title">${row.title}</h2>
        <a href="${row.link}" class="see-all">See all →</a>
      </div>
      <div class="cards-scroll" id="dyn-row-${i}"></div>
    </div>
  `).join('');

  // Diagnostic: if no rows built but we have content, log why
  if (!rows.length) {
    console.log('[dynamic-rows] built 0 rows. displayItems:', displayItems.length,
      'categories:', [...new Set(displayItems.map(d => d.category))]);
  }

  // Fill each row's cards
  rows.forEach((row, i) => {
    const el = document.getElementById(`dyn-row-${i}`);
    if (el) el.innerHTML = row.items.map(item => cardHTML(item)).join('');
  });
}

function renderRowCards(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:8px 0;">No content yet.</div>`;
    return;
  }
  el.innerHTML = items.map(item => cardHTML(item)).join('');
}

function renderTopN(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.map((item, i) => `
    <div class="num-card" onclick="window.location.href='${videoUrl(item)}'">
      <div class="num-big">${i + 1}</div>
      <div class="num-card-img">
        <img src="${getThumb(item)}" alt="${item.title || ''}" loading="lazy" onerror="this.parentElement.style.background='var(--surface2)'">
      </div>
    </div>
  `).join('');
}

function cardHTML(item) {
  const thumb = getThumb(item);
  const isSeries = item._isSeries;
  const realLikes = item._likeCount || 0;

  return `
    <div class="card" onclick="window.location.href='${videoUrl(item)}'">
      <div class="card-thumb">
        <img src="${thumb}" alt="${item.title || ''}" loading="lazy" onerror="this.src='https://img.youtube.com/vi/default/hqdefault.jpg'">
        <div class="card-play-overlay">
          <div class="play-circle"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        </div>
        <span class="card-cat-badge">${item.category || ''}</span>
        ${isSeries
          ? `<span class="card-ep-badge">${item._epCount} EP${item._epCount > 1 ? 'S' : ''}</span>`
          : `<span class="card-like-count">❤️ ${realLikes > 0 ? realLikes : ''}</span>`}
      </div>
      <div class="card-body">
        <div class="card-title">${item.title || ''}</div>
        <div class="card-sub">${isSeries ? 'Series · ' : ''}${item.language || ''} ${item.location ? '· ' + item.location : ''}</div>
      </div>
    </div>
  `;
}

window.toggleLike = (id, btn) => {
  if (!currentUser) {
    showToast('Sign in to like content');
    return;
  }
  const isLiked = !!likes[id];
  if (isLiked) {
    delete likes[id];
    btn.innerHTML = `🤍`;
    btn.classList.remove('liked');
    showToast('Like removed');
  } else {
    likes[id] = 1;
    btn.innerHTML = `❤️ 1`;
    btn.classList.add('liked');
    showToast('Liked!');
  }
  localStorage.setItem('gtv_likes', JSON.stringify(likes));
};

function toggleFavourite(item) {
  if (!currentUser) {
    showToast('Sign in to save favourites');
    return false;
  }
  const idx = favourites.findIndex(f => f.$id === item.$id);
  if (idx === -1) {
    favourites.push(item);
    localStorage.setItem('gtv_favs', JSON.stringify(favourites));
    showToast('Added to favourites 🔖');
    return true;
  } else {
    favourites.splice(idx, 1);
    localStorage.setItem('gtv_favs', JSON.stringify(favourites));
    showToast('Removed from favourites');
    return false;
  }
}

function initCategoryPills() {
  const cats = ['all', 'movie', 'webseries', 'music', 'documentary'];
  const labels = { all: 'All', movie: 'Movies', webseries: 'Web Series', music: 'Music', documentary: 'Docs' };
  const bar = document.getElementById('cats-bar');
  if (!bar) return;

  bar.innerHTML = cats.map(c => `<div class="cat-pill ${c === 'all' ? 'active' : ''}" data-cat="${c}">${labels[c]}</div>`).join('');
  bar.addEventListener('click', e => {
    const pill = e.target.closest('.cat-pill');
    if (!pill) return;
    const cat = pill.dataset.cat;
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    window.location.href = browseUrl(cat);
  });
}

function initSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;

  // Press Enter → go to dedicated search page
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      window.location.href = q ? `pages/search.html?q=${encodeURIComponent(q)}` : 'pages/search.html';
    }
  });

  // Typing also live-filters the Latest row on the homepage (quick preview)
  input.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      renderRows();
      return;
    }

    const results = displayItems.filter(d =>
      (d.title || '').toLowerCase().includes(q) ||
      (d.cast || '').toLowerCase().includes(q) ||
      (d.director || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q)
    );

    const latest = document.getElementById('latest-row');
    if (!latest) return;
    latest.innerHTML = results.length
      ? results.map(item => cardHTML(item)).join('')
      : `<div style="color:var(--muted);font-size:13px;padding:8px 0;">No results for "${q}" — <a href="pages/search.html?q=${encodeURIComponent(q)}" style="color:var(--red);">full search →</a></div>`;
  });
}

window.showToast = (msg) => {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
};
