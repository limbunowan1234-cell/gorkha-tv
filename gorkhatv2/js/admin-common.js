// Shared by every admin page: session check, login/logout, a fetch wrapper
// that redirects to the login gate on 401, and a toast helper (same visual
// pattern as the public site's window.showToast, kept local here since admin
// pages don't load js/main.js).

const API_BASE = '/api/admin';

export async function adminFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
  });

  if (res.status === 401) {
    showLoginGate();
    throw new Error('Session expired — please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export async function checkAdminAuth() {
  try {
    await adminFetch('/me');
    return true;
  } catch {
    return false;
  }
}

export async function adminLogin(password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed.');
}

export async function adminLogout() {
  await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
}

export function showLoginGate() {
  const gate = document.getElementById('admin-login-gate');
  const app = document.getElementById('admin-app');
  if (gate) gate.style.display = 'flex';
  if (app) app.style.display = 'none';
}

export function showApp() {
  const gate = document.getElementById('admin-login-gate');
  const app = document.getElementById('admin-app');
  if (gate) gate.style.display = 'none';
  if (app) app.style.display = 'block';
}

export function toast(msg) {
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
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Wires up the login form + logout buttons and gates the page behind a
// session check. Call once per admin page with a callback that renders the
// page's actual content once authenticated.
export async function initAdminPage(onReady) {
  const form = document.getElementById('admin-login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const passwordInput = document.getElementById('admin-password-input');
      const errEl = document.getElementById('admin-login-error');
      if (errEl) errEl.textContent = '';
      try {
        await adminLogin(passwordInput.value);
        passwordInput.value = '';
        showApp();
        onReady();
      } catch (err) {
        if (errEl) errEl.textContent = err.message;
      }
    });
  }

  document.querySelectorAll('[data-admin-logout]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await adminLogout();
      window.location.reload();
    })
  );

  const authed = await checkAdminAuth();
  if (authed) {
    showApp();
    onReady();
  } else {
    showLoginGate();
  }
}
