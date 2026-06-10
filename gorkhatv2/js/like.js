// Shared real likes + shares helper (global counts via Appwrite)
import { databases, account, DB_ID, LIKES_COLLECTION_ID, ID, Query } from './appwrite.js';

// Returns { like: N, share: N } counts for a content id
export async function getCounts(contentId) {
  try {
    const [likeRes, shareRes] = await Promise.all([
      databases.listDocuments(DB_ID, LIKES_COLLECTION_ID, [
        Query.equal('contentId', contentId), Query.equal('type', 'like'), Query.limit(1)
      ]),
      databases.listDocuments(DB_ID, LIKES_COLLECTION_ID, [
        Query.equal('contentId', contentId), Query.equal('type', 'share'), Query.limit(1)
      ])
    ]);
    return { like: likeRes.total, share: shareRes.total };
  } catch (e) {
    console.error('getCounts failed', e);
    return { like: 0, share: 0 };
  }
}

// Bulk: fetch like+share counts. Returns map { contentId: { like, share } }.
// Single bounded query per type — never hangs, fails safe to zeros.
export async function getBulkCounts(contentIds) {
  const map = {};
  contentIds.forEach(id => map[id] = { like: 0, share: 0 });
  if (!contentIds.length) return map;
  try {
    const res = await databases.listDocuments(DB_ID, LIKES_COLLECTION_ID, [Query.limit(500)]);
    res.documents.forEach(d => {
      if (map[d.contentId] && (d.type === 'like' || d.type === 'share')) {
        map[d.contentId][d.type] += 1;
      }
    });
  } catch (e) { console.error('getBulkCounts failed (using zeros):', e); }
  return map;
}

// Has the current user liked this? returns the doc id or null
export async function getUserLike(contentId, userId) {
  if (!userId) return null;
  try {
    const res = await databases.listDocuments(DB_ID, LIKES_COLLECTION_ID, [
      Query.equal('contentId', contentId),
      Query.equal('userId', userId),
      Query.equal('type', 'like'),
      Query.limit(1)
    ]);
    return res.documents[0]?.$id || null;
  } catch (e) { console.error(e); return null; }
}

// Toggle a like. Returns { liked: bool, count: N }
export async function toggleLike(contentId, userId) {
  const existingId = await getUserLike(contentId, userId);
  if (existingId) {
    await databases.deleteDocument(DB_ID, LIKES_COLLECTION_ID, existingId);
  } else {
    await databases.createDocument(DB_ID, LIKES_COLLECTION_ID, ID.unique(), {
      contentId, userId, type: 'like'
    });
  }
  const counts = await getCounts(contentId);
  return { liked: !existingId, count: counts.like };
}

// Record a share (always adds a row). Returns new share count.
export async function recordShare(contentId, userId) {
  try {
    await databases.createDocument(DB_ID, LIKES_COLLECTION_ID, ID.unique(), {
      contentId, userId: userId || 'anon', type: 'share'
    });
  } catch (e) { console.error('share record failed', e); }
  const counts = await getCounts(contentId);
  return counts.share;
}

// Native share sheet (falls back to copying link)
export async function shareContent(title, url) {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return true; }
    catch { return false; }
  } else {
    try { await navigator.clipboard.writeText(url); return 'copied'; }
    catch { return false; }
  }
}
