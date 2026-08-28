// Native GorkhaTV comments on the watch page — NOT the read-only YouTube-
// comments mirror used by Shorts/Feed (that stays untouched). Every comment
// body is untrusted free text from other viewers and MUST go through
// escapeHtml() before touching innerHTML.
import { apiFetch, escapeHtml, showToast } from './api.js';
import { getCurrentUser } from './auth.js';

const PAGE_LIMIT = 20;
let youtubeVideoId = null;
let page = 1;
let total = 0;

export async function initComments(video) {
  youtubeVideoId = video.youtube_video_id;
  renderComposer();
  await loadComments();
}

function renderComposer() {
  const el = document.getElementById('comment-composer');
  const user = getCurrentUser();

  if (!user) {
    el.innerHTML = `<div class="comment-composer-signedout" id="comment-signin-prompt">Sign in to leave a comment</div>`;
    document.getElementById('comment-signin-prompt').addEventListener('click', () => showToast('Sign in to comment'));
    return;
  }

  el.innerHTML = `
    <div class="comment-composer">
      ${avatarHTML(user.avatarUrl, user.name)}
      <div style="flex:1;">
        <textarea id="comment-input" rows="2" maxlength="1000" placeholder="Add a comment…"></textarea>
        <button class="comment-submit-btn" id="comment-submit-btn">Comment</button>
      </div>
    </div>`;

  document.getElementById('comment-submit-btn').addEventListener('click', () => submitComment(null, document.getElementById('comment-input')));
}

function avatarHTML(url, name) {
  const initial = name ? escapeHtml(name[0].toUpperCase()) : '?';
  return url
    ? `<img class="comment-avatar" src="${escapeHtml(url)}" alt="">`
    : `<div class="comment-avatar" style="display:flex;align-items:center;justify-content:center;font-weight:700;">${initial}</div>`;
}

async function loadComments(append = false) {
  const list = document.getElementById('comments-list');
  const loadMoreBtn = document.getElementById('load-more-comments');
  try {
    const data = await apiFetch(`/videos/${encodeURIComponent(youtubeVideoId)}/native-comments?page=${page}&limit=${PAGE_LIMIT}`);
    total = data.total;
    document.getElementById('comments-count-title').textContent = total ? `${total} Comment${total === 1 ? '' : 's'}` : 'Comments';

    const html = data.comments.map(commentHTML).join('');
    if (append) list.insertAdjacentHTML('beforeend', html);
    else list.innerHTML = html || `<div style="color:var(--muted);font-size:13px;">No comments yet — be the first.</div>`;

    loadMoreBtn.style.display = page * PAGE_LIMIT < total ? '' : 'none';
    loadMoreBtn.onclick = () => {
      page += 1;
      loadComments(true);
    };

    document.querySelectorAll('.comment-item[data-fresh]').forEach((el) => el.removeAttribute('data-fresh'));
  } catch (err) {
    list.innerHTML = `<div style="color:var(--muted);font-size:13px;">Couldn't load comments: ${escapeHtml(err.message)}</div>`;
  }
}

function commentHTML(c) {
  const isOwn = getCurrentUser()?.id === c.user_id;
  return `
    <div class="comment-item" data-id="${c.id}">
      ${avatarHTML(c.author_avatar_url, c.author_name)}
      <div class="comment-body-wrap">
        <div class="comment-author">${escapeHtml(c.author_name)}<span class="comment-date">${formatDate(c.created_at)}</span></div>
        <p class="comment-text">${escapeHtml(c.body)}</p>
        <div class="comment-row-actions">
          <button data-action="reply-toggle">Reply</button>
          ${c.reply_count > 0 ? `<button data-action="view-replies">View ${c.reply_count} repl${c.reply_count === 1 ? 'y' : 'ies'}</button>` : ''}
          ${isOwn ? `<button data-action="delete">Delete</button>` : ''}
        </div>
        <div class="reply-composer" id="reply-composer-${c.id}">
          <textarea rows="1" maxlength="1000" placeholder="Reply…"></textarea>
          <button class="comment-reply-submit-btn" data-action="reply-submit">Reply</button>
        </div>
        <div class="comment-replies" id="replies-${c.id}" style="display:none;"></div>
      </div>
    </div>`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString();
}

async function submitComment(parentCommentId, textarea) {
  const text = textarea.value.trim();
  if (!text) return;

  try {
    const res = await fetch(`/api/videos/${encodeURIComponent(youtubeVideoId)}/native-comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ body: text, parentCommentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to post comment.');
    const { comment } = data;

    textarea.value = '';
    if (parentCommentId) {
      const repliesEl = document.getElementById(`replies-${parentCommentId}`);
      repliesEl.insertAdjacentHTML('beforeend', commentHTML(comment));
      repliesEl.style.display = '';
      document.getElementById(`reply-composer-${parentCommentId}`).style.display = 'none';
    } else {
      total += 1;
      document.getElementById('comments-count-title').textContent = `${total} Comment${total === 1 ? '' : 's'}`;
      document.getElementById('comments-list').insertAdjacentHTML('afterbegin', commentHTML(comment));
    }
    showToast('Comment posted');
  } catch (err) {
    showToast(err.message || 'Failed to post comment.');
  }
}

async function loadReplies(commentId) {
  const el = document.getElementById(`replies-${commentId}`);
  el.innerHTML = `<div class="loading" style="padding:10px;"><div class="spinner"></div></div>`;
  el.style.display = '';
  try {
    const { replies } = await apiFetch(`/videos/${encodeURIComponent(youtubeVideoId)}/native-comments/${encodeURIComponent(commentId)}/replies`);
    el.innerHTML = replies.map(commentHTML).join('');
  } catch {
    el.innerHTML = `<div style="color:var(--muted);font-size:12px;">Couldn't load replies.</div>`;
  }
}

// Single delegated listener for the whole comment tree — handles reply
// toggle/submit, view-replies, and delete, at any nesting depth (comments
// list + dynamically-appended replies), same rationale as my-favourites.js's
// delegated click handler.
document.addEventListener('click', async (e) => {
  const item = e.target.closest('.comment-item');
  if (!item || !document.getElementById('comments-list')?.contains(item)) return;
  const commentId = item.dataset.id;
  const action = e.target.dataset.action;
  if (!action) return;

  if (action === 'reply-toggle') {
    if (!getCurrentUser()) {
      showToast('Sign in to reply');
      return;
    }
    const composer = document.getElementById(`reply-composer-${commentId}`);
    composer.style.display = composer.style.display === 'flex' ? 'none' : 'flex';
    return;
  }

  if (action === 'reply-submit') {
    const composer = document.getElementById(`reply-composer-${commentId}`);
    await submitComment(commentId, composer.querySelector('textarea'));
    return;
  }

  if (action === 'view-replies') {
    loadReplies(commentId);
    return;
  }

  if (action === 'delete') {
    if (!confirm('Delete this comment?')) return;
    try {
      await fetch(`/api/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE', credentials: 'include' });
      item.remove();
      showToast('Comment deleted');
    } catch {
      showToast('Failed to delete — please try again.');
    }
  }
});
