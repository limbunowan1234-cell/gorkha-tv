// Shared viewer nav-auth widget, imported by every public page (home, watch,
// browse, search, creator). Uses Google Identity Services (GIS) — a button
// Google renders client-side, no redirect flow, no client secret needed —
// and POSTs the resulting id_token to /api/auth/google/verify.

import { escapeHtml, showToast } from './api.js';

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export async function initAuthNav() {
  pingActivity(); // fire-and-forget, runs on every public page load — powers admin analytics (DAU/MAU)

  const navRight = document.getElementById('nav-right');
  if (!navRight) return;

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      renderUserNav();
      return;
    }
  } catch {
    /* fall through to sign-in button */
  }

  renderSignInButton();
}

function pingActivity() {
  fetch('/api/track/ping', { method: 'POST', credentials: 'include' }).catch(() => {});
}

async function renderSignInButton() {
  const navRight = document.getElementById('nav-right');
  navRight.innerHTML = `<div id="gsi-button-container"></div>`;

  try {
    const res = await fetch('/api/auth/config');
    const { googleClientId } = await res.json();
    if (!googleClientId) return; // sign-in not configured on this deployment — omit silently

    await loadGoogleIdentityScript();
    window.google.accounts.id.initialize({ client_id: googleClientId, callback: handleCredentialResponse });
    window.google.accounts.id.renderButton(document.getElementById('gsi-button-container'), {
      theme: 'filled_black',
      size: 'medium',
      shape: 'pill',
    });
  } catch (err) {
    console.warn('Google sign-in unavailable:', err);
  }
}

function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script.'));
    document.head.appendChild(script);
  });
}

async function handleCredentialResponse(response) {
  try {
    const res = await fetch('/api/auth/google/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential: response.credential }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Sign-in failed.');
    }

    const meRes = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await meRes.json();
    currentUser = data.user;
    renderUserNav();
    showToast(`Welcome, ${currentUser.name || 'there'}!`);
  } catch (err) {
    showToast(err.message || 'Sign-in failed. Please try again.');
  }
}

function renderUserNav() {
  const navRight = document.getElementById('nav-right');
  const initial = currentUser.name ? currentUser.name[0].toUpperCase() : '?';

  navRight.innerHTML = `
    <div class="user-menu-wrap">
      <div class="user-avatar" onclick="window.__gtvToggleDropdown()" title="${escapeHtml(currentUser.name || '')}">
        ${currentUser.avatarUrl ? `<img src="${escapeHtml(currentUser.avatarUrl)}" alt="">` : initial}
      </div>
      <div class="user-dropdown" id="user-dropdown">
        <div class="dropdown-header">
          <div class="name">${escapeHtml(currentUser.name || '')}</div>
          <div class="email">${escapeHtml(currentUser.email || '')}</div>
        </div>
        <a href="/pages/my-favourites.html" class="dropdown-item">🔖 My Favourites</a>
        <a href="/pages/edit-profile.html" class="dropdown-item">✏️ Edit Profile</a>
        <hr class="dropdown-divider">
        <button onclick="window.__gtvLogout()" class="dropdown-item danger">Sign out</button>
      </div>
    </div>`;
}

window.__gtvToggleDropdown = () => {
  document.getElementById('user-dropdown')?.classList.toggle('open');
};

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.user-menu-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('user-dropdown')?.classList.remove('open');
  }
});

window.__gtvLogout = async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.reload();
};
