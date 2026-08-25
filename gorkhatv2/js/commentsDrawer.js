// Real YouTube comments (functions/api/videos/[id]/comments.js) — read-only,
// viewers reply on YouTube itself. Shared by both the full-screen Shorts
// page and the scrollable Feed page — each carries the same
// #comments-backdrop/#comments-sheet/#comments-list/#comments-close markup
// and CSS, this module just drives it. Call initCommentsDrawer() once on
// page load, then openComments(item) from wherever a "Comments" button lives.
import { apiFetch, escapeHtml } from './api.js';

let commentsBackdrop, commentsSheet, commentsList;
let commentsRequestToken = 0;

export function initCommentsDrawer() {
  commentsBackdrop = document.getElementById('comments-backdrop');
  commentsSheet = document.getElementById('comments-sheet');
  commentsList = document.getElementById('comments-list');
  if (!commentsBackdrop || !commentsSheet || !commentsList) return;

  commentsBackdrop.addEventListener('click', closeComments);
  document.getElementById('comments-close')?.addEventListener('click', closeComments);
}

export async function openComments(item) {
  commentsBackdrop.classList.add('open');
  commentsSheet.classList.add('open');
  commentsList.innerHTML = `<div class="loading" style="padding:24px 0;"><div class="spinner"></div></div>`;

  const requestToken = ++commentsRequestToken;
  try {
    const { comments, disabled } = await apiFetch(`/videos/${encodeURIComponent(item.youtube_video_id)}/comments`);
    if (requestToken !== commentsRequestToken) return; // viewer already moved on — drop this stale response

    if (disabled) {
      commentsList.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:24px 0;text-align:center;">Comments are off for this video.</div>`;
    } else if (!comments.length) {
      commentsList.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:24px 0;text-align:center;">No comments yet.</div>`;
    } else {
      commentsList.innerHTML = comments.map(commentItemHTML).join('');
    }
  } catch {
    if (requestToken !== commentsRequestToken) return;
    commentsList.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:24px 0;text-align:center;">Couldn't load comments — please try again.</div>`;
  }
}

function commentItemHTML(c) {
  const avatar = c.authorAvatar || '';
  return `
    <div class="shorts-comment-item">
      <img class="shorts-comment-avatar" src="${escapeHtml(avatar)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="shorts-comment-body">
        <div class="shorts-comment-author">${escapeHtml(c.author || 'YouTube user')}</div>
        <div class="shorts-comment-text">${escapeHtml(c.text || '')}</div>
        <div class="shorts-comment-meta">
          ${c.likeCount ? `<span>👍 ${escapeHtml(String(c.likeCount))}</span>` : ''}
          ${c.publishedAt ? `<span>${new Date(c.publishedAt).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    </div>`;
}

export function closeComments() {
  commentsBackdrop.classList.remove('open');
  commentsSheet.classList.remove('open');
  commentsRequestToken++; // invalidate any in-flight fetch so a late response can't reopen/repopulate a closed sheet
}
