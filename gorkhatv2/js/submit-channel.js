import { apiFetch, escapeHtml } from './api.js';
import { initAuthNav } from './auth.js';

initAuthNav();

async function populateSelects() {
  try {
    const [{ categories }, { locations }] = await Promise.all([apiFetch('/categories'), apiFetch('/locations')]);
    document.getElementById('channel-category').insertAdjacentHTML('beforeend', categories.map((c) => `<option value="${c.slug}">${escapeHtml(c.label)}</option>`).join(''));
    document.getElementById('channel-location').insertAdjacentHTML('beforeend', locations.map((l) => `<option value="${l}">${l}</option>`).join(''));
  } catch {
    /* selects are optional */
  }
}

document.getElementById('submit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('submit-error');
  errEl.textContent = '';

  const payload = {
    channelUrl: document.getElementById('channel-url').value.trim(),
    channelName: document.getElementById('channel-name').value.trim(),
    category: document.getElementById('channel-category').value || undefined,
    location: document.getElementById('channel-location').value || undefined,
    contactName: document.getElementById('contact-name').value.trim() || undefined,
    contactEmail: document.getElementById('contact-email').value.trim() || undefined,
  };

  try {
    const res = await fetch('/api/creators/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Submission failed.');

    document.getElementById('submit-card').innerHTML = `
      <div class="submit-success">
        <div class="icon">✅</div>
        <h3>Thanks — your channel is in the queue!</h3>
        <p class="text-muted" style="margin-top:8px;">An admin will review it shortly. Once approved, GorkhaTV starts monitoring it automatically.</p>
      </div>`;
  } catch (err) {
    errEl.textContent = err.message;
  }
});

populateSelects();
