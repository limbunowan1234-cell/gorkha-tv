import { databases, storage, account, DB_ID, COLLECTION_ID, BUCKET_ID, ADMIN_EMAIL, Query } from './appwrite.js';

// ── STATE ──
let currentUser = null;
let allContent = [];
let heroItems = [];
let heroIndex = 0;
let heroTimer = null;
let likes = JSON.parse(localStorage.getItem('gtv_likes') || '{}');
let favourites = JSON.parse(localStorage.getItem('gtv_favs') || '[]');

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadContent();
  initCategoryPills();
  initModal();
  initSearch();
});

// ── AUTH ──
async function checkAuth() {
  try {
    currentUser = await account.get();
    renderUserNav();
  } catch {
    currentUser = null;
    renderLoginBtn();
  }
}

function renderUserNav() {
  const nr = document.getElementById('nav-right');
  const initial = currentUser.name ? currentUser.name[0].toUpperCase() : '?';
  const isAdmin = currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  nr.innerHTML = `
    <div class="user-menu-wrap">
      <div class="user-avatar" onclick="toggleDropdown()" title="${currentUser.name}">
        ${currentUser.prefs?.avatar ? `<img src="${currentUser.prefs.avatar}" alt="">` : initial}
      </div>
      <div class="user-dropdown" id="user-dropdown">
        <div class="dropdown-header">
          <div class="name">${currentUser.name}</div>
          <div class="email">${currentUser.email}</div>
        </div>
        <a href="pages/my-favourites.html" class="dropdown-item">🔖 My Favourites</a>
        <a href="pages/my-credits.html" class="dropdown-item">⭐ My Credits</a>
        <a href="pages/edit-profile.html" class="dropdown-item">🎭 My Artist Profile</a>
        ${isAdmin ? `<a href="pages/admin.html" class="dropdown-item">🛠 Admin Panel</a>` : ''}
        <hr class="dropdown-divider">
        <button onclick="logout()" class="dropdown-item danger">Sign out</button>
      </div>
    </div>
  `;
}

function renderLoginBtn() {
  document.getElementById('nav-right').innerHTML = `
    <button class="btn-signin" onclick="loginWithGoogle()">Sign In</button>
  `;
}

window.toggleDropdown = () => {
  document.getElementById('user-dropdown')?.classList.toggle('open');
};

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.user-menu-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('user-dropdown')?.classList.remove('open');
  }
});

window.loginWithGoogle = async () => {
  try {
    // Use full hardcoded URLs - required for Safari iOS
    account.createOAuth2Token(
      'google',
      'https://gorkhatv.site/pages/auth-callback.html',
      'https://gorkhatv.site'
    );
  } catch (err) {
    console.error('Login error:', err);
  }
};

window.logout = async () => {
  try { await account.deleteSession('current'); } catch {}
  window.location.reload();
};

// ── LOAD CONTENT ──
async function loadContent() {
  try {
    const res = await databases.listDocuments(DB_ID, COLLECTION_ID, [
      Query.equal('status', 'published'),
      Query.orderDesc('publishedAt'),
      Query.limit(60)
    ]);
    allContent = res.documents;
    heroItems = [...allContent.filter(d => d.featured), ...allContent].slice(0, 6);
    const seen = new Set();
    heroItems = heroItems.filter(d => {
      if (seen.has(d.$id)) return false;
      seen.add(d.$id);
      return true;
    }).slice(0, 5);
    renderHero();
    startHeroTimer();
    renderRows();
  } catch (err) {
    console.error('Load error:', err);
  }
}

// ── HERO ──
function renderHero() {
  if (!heroItems.length) return;
  const item = heroItems[heroIndex];
  const thumb = getThumb(item, 'max');
  document.getElementById('hero-bg').style.backgroundImage = `url(${thumb})`;
  document.getElementById('hero-tag').textContent = item.category;
  document.getElementById('hero-title').textContent = item.title;
  document.getElementById('hero-desc').textContent = item.description || '';
  const meta = [];
  if (item.publishedAt) meta.push(`<span>${new Date(item.publishedAt).getFullYear()}</span>`);
  if (item.language) meta.push(`<div class="dot"></div><span class="lang-badge">${item.language.slice(0,3).toUpperCase()}</span>`);
  if (item.location) meta.push(`<div class="dot"></div><span>${item.location}</span>`);
  document.getElementById('hero-meta').innerHTML = meta.join('');
  document.getElementById('hero-play-btn').onclick = () => openModal(item);
  document.getElementById('hero-more-btn').onclick = () => openModal(item);
  const dotsEl = document.getElementById('hero-dots');
  dotsEl.innerHTML = heroItems.map((_, i) =>
    `<div onclick="goHero(${i})" style="width:${i===heroIndex?'24':'8'}px;height:8px;border-radius:4px;background:${i===heroIndex?'var(--red)':'rgba(255,255,255,0.25)'};cursor:pointer;transition:all 0.3s;"></div>`
  ).join('');
}

window.goHero = (i) => { heroIndex = i; renderHero(); resetHeroTimer(); };
function startHeroTimer() {
  if (heroItems.length <= 1) return;
  heroTimer = setInterval(() => { heroIndex = (heroIndex + 1) % heroItems.length; renderHero(); }, 7000);
}
function resetHeroTimer() { clearInterval(heroTimer); startHeroTimer(); }

// ── ROWS ──
function renderRows(category = 'all') {
  const filtered = category === 'all' ? allContent : allContent.filter(d => d.category === category);
  const featured = allContent.filter(d => d.featured).slice(0, 8);
  const latest = filtered.slice(0, 12);
  const topLiked = [...allContent].sort((a, b) => (likes[b.$id] || 0) - (likes[a.$id] || 0)).slice(0, 5);
  renderRowCards('featured-row', featured);
  renderTopN('topn-row', topLiked);
  renderRowCards('latest-row', latest);
}

function renderRowCards(id, items) {
  const el = document.getElementById(id);
  if (!items.length) { el.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:8px 0;">No content yet.</div>`; return; }
  el.innerHTML = items.map(item => cardHTML(item)).join('');
}

function renderTopN(id, items) {
  const el = document.getElementById(id);
  el.innerHTML = items.map((item, i) => `
    <div class="num-card" onclick='openModal(${safeJSON(item)})'>
      <div class="num-big">${i + 1}</div>
      <div class="num-card-img">
        <img src="${getThumb(item)}" alt="${item.title}" loading="lazy" onerror="this.parentElement.style.background='var(--surface2)'">
      </div>
    </div>
  `).join('');
}

function cardHTML(item) {
  const thumb = getThumb(item);
  const isLiked = likes[item.$id] > 0;
  const likeCount = likes[item.$id] || 0;
  return `
    <div class="card" onclick='openModal(${safeJSON(item)})'>
      <div class="card-thumb">
        <img src="${thumb}" alt="${item.title}" loading="lazy" onerror="this.src='https://img.youtube.com/vi/default/hqdefault.jpg'">
        <div class="card-play-overlay">
          <div class="play-circle"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        </div>
        <span class="card-cat-badge">${item.category}</span>
        <button class="card-like-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation();toggleLike('${item.$id}', this)">
          ${isLiked ? '❤️' : '🤍'} ${likeCount > 0 ? likeCount : ''}
        </button>
      </div>
      <div class="card-body">
        <div class="card-title">${item.title}</div>
        <div class="card-sub">${item.language || ''} ${item.location ? '· ' + item.location : ''}</div>
      </div>
    </div>
  `;
}

function getThumb(item, size = 'hq') {
  if (item.thumbnailFileId) return storage.getFileView(BUCKET_ID, item.thumbnailFileId);
  if (item.youtube_id) return `https://img.youtube.com/vi/${item.youtube_id}/${size === 'max' ? 'maxresdefault' : 'hqdefault'}.jpg`;
  return '';
}

window.toggleLike = (id, btn) => {
  if (!currentUser) { showToast('Sign in to like content'); return; }
  const isLiked = !!likes[id];
  if (isLiked) { delete likes[id]; btn.innerHTML = `🤍`; btn.classList.remove('liked'); showToast('Like removed'); }
  else { likes[id] = 1; btn.innerHTML = `❤️ 1`; btn.classList.add('liked'); showToast('Liked!'); }
  localStorage.setItem('gtv_likes', JSON.stringify(likes));
};

function toggleFavourite(item) {
  if (!currentUser) { showToast('Sign in to save favourites'); return false; }
  const idx = favourites.findIndex(f => f.$id === item.$id);
  if (idx === -1) { favourites.push(item); localStorage.setItem('gtv_favs', JSON.stringify(favourites)); showToast('Added to favourites 🔖'); return true; }
  else { favourites.splice(idx, 1); localStorage.setItem('gtv_favs', JSON.stringify(favourites)); showToast('Removed from favourites'); return false; }
}

function initCategoryPills() {
  const cats = ['all','movie','webseries','music','documentary','news'];
  const labels = { all:'All', movie:'Movies', webseries:'Web Series', music:'Music', documentary:'Docs', news:'News' };
  const bar = document.getElementById('cats-bar');
  bar.innerHTML = cats.map(c => `<div class="cat-pill ${c==='all'?'active':''}" data-cat="${c}">${labels[c]}</div>`).join('');
  bar.addEventListener('click', e => {
    const pill = e.target.closest('.cat-pill');
    if (!pill) return;
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    renderRows(pill.dataset.cat);
  });
}

function initSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { renderRows(); return; }
    const results = allContent.filter(d =>
      d.title.toLowerCase().includes(q) ||
      (d.cast || '').toLowerCase().includes(q) ||
      (d.director || '').toLowerCase().includes(q)
    );
    document.getElementById('latest-row').innerHTML = results.length
      ? results.map(item => cardHTML(item)).join('')
      : `<div style="color:var(--muted);font-size:13px;padding:8px 0;">No results for "${q}"</div>`;
  });
}

let modalItem = null;

function initModal() {
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

window.openModal = (item) => {
  if (typeof item === 'string') item = JSON.parse(item);
  modalItem = item;
  document.getElementById('modal-video').innerHTML = `<iframe src="https://www.youtube.com/embed/${item.youtube_id}?autoplay=1&rel=0" allowfullscreen allow="autoplay"></iframe>`;
  document.getElementById('modal-title').textContent = item.title;
  document.getElementById('modal-desc').textContent = item.description || '';
  const meta = [];
  if (item.category) meta.push(`<span><strong>Category:</strong> ${item.category}</span>`);
  if (item.director) meta.push(`<span><strong>Director:</strong> ${item.director}</span>`);
  if (item.cast) meta.push(`<span><strong>Cast:</strong> ${item.cast}</span>`);
  if (item.language) meta.push(`<span><strong>Language:</strong> ${item.language}</span>`);
  if (item.location) meta.push(`<span><strong>Location:</strong> ${item.location}</span>`);
  document.getElementById('modal-meta').innerHTML = meta.join('');
  const isLiked = !!likes[item.$id];
  document.getElementById('modal-like-btn').className = `modal-like-btn ${isLiked ? 'liked' : ''}`;
  document.getElementById('modal-like-btn').innerHTML = `${isLiked ? '❤️' : '🤍'} ${isLiked ? 'Liked' : 'Like'}`;
  const isFav = favourites.some(f => f.$id === item.$id);
  document.getElementById('modal-fav-btn').className = `modal-fav-btn ${isFav ? 'saved' : ''}`;
  document.getElementById('modal-fav-btn').innerHTML = isFav ? '🔖 Saved' : '+ My List';
  const claimEl = document.getElementById('modal-claim');
  if (item.cast || item.director) {
    claimEl.innerHTML = currentUser
      ? `<button class="claim-btn" onclick="claimCredit()">⭐ I worked on this — Verify my credit</button>`
      : `<button class="claim-btn" onclick="loginWithGoogle()">Sign in to verify your credit</button>`;
  } else { claimEl.innerHTML = ''; }
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeModal = () => {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('modal-video').innerHTML = '';
  document.body.style.overflow = '';
  modalItem = null;
};

window.modalLike = () => {
  if (!modalItem || !currentUser) { showToast('Sign in to like'); return; }
  const isLiked = !!likes[modalItem.$id];
  if (isLiked) { delete likes[modalItem.$id]; showToast('Like removed'); }
  else { likes[modalItem.$id] = 1; showToast('Liked! ❤️'); }
  localStorage.setItem('gtv_likes', JSON.stringify(likes));
  const btn = document.getElementById('modal-like-btn');
  const nowLiked = !!likes[modalItem.$id];
  btn.className = `modal-like-btn ${nowLiked ? 'liked' : ''}`;
  btn.innerHTML = `${nowLiked ? '❤️' : '🤍'} ${nowLiked ? 'Liked' : 'Like'}`;
};

window.modalFav = () => {
  if (!modalItem) return;
  const saved = toggleFavourite(modalItem);
  const btn = document.getElementById('modal-fav-btn');
  btn.className = `modal-fav-btn ${saved ? 'saved' : ''}`;
  btn.innerHTML = saved ? '🔖 Saved' : '+ My List';
};

window.claimCredit = () => {
  if (!currentUser || !modalItem) return;
  showToast('Credit claim submitted! Admin will verify soon. ⭐');
};

window.showToast = (msg) => {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
};

function safeJSON(item) {
  return JSON.stringify(item).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}
