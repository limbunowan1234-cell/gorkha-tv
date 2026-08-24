import { json, errorResponse, readJsonBody } from '../../../shared/http.js';
import { insertChannelSubmission, checkRateLimit, getSessionUser } from '../../../shared/db.js';
import { parseCookies } from '../../../shared/auth.js';
import { VIEWER_SESSION_COOKIE } from '../../../shared/constants.js';

const YOUTUBE_URL_PATTERN = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i;
const MAX_SUBMISSIONS_PER_WINDOW = 5;

// Public "Submit Your YouTube Channel" endpoint. Deliberately does NOT call
// the YouTube API here — a public, unauthenticated form is an easy quota-abuse
// vector (spam submissions burning API calls). The submission is stored as
// 'pending' with just what the submitter typed; the first real YouTube
// lookup happens when an admin approves it (functions/api/admin/creators/[id]/approve.js).
export async function onRequestPost(context) {
  const { request, env } = context;

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const { allowed } = await checkRateLimit(env.DB, `submit-channel:${ip}`, MAX_SUBMISSIONS_PER_WINDOW);
  if (!allowed) {
    return errorResponse('Too many submissions from this network. Please try again later.', 429);
  }

  const body = await readJsonBody(request);

  const channelUrl = body?.channelUrl?.trim();
  const channelName = body?.channelName?.trim();
  if (!channelUrl || !channelName) {
    return errorResponse('Channel URL and channel name are required.', 400);
  }
  if (!YOUTUBE_URL_PATTERN.test(channelUrl)) {
    return errorResponse('Please provide a valid youtube.com or youtu.be channel URL.', 400);
  }
  if (body.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.contactEmail)) {
    return errorResponse('Please provide a valid contact email.', 400);
  }

  // If the submitter is signed in, record them as the owner — this is what
  // later lets them self-edit the channel's descriptive fields via
  // /api/my/channels. Anonymous submissions remain fully supported.
  const cookies = parseCookies(request.headers.get('Cookie'));
  const viewer = await getSessionUser(env.DB, cookies[VIEWER_SESSION_COOKIE]);

  try {
    const id = await insertChannelSubmission(env.DB, {
      channelName,
      channelUrl,
      location: body?.location || null,
      category: body?.category || null,
      contactName: body?.contactName || null,
      contactEmail: body?.contactEmail || null,
      submittedByUserId: viewer?.id || null,
    });
    return json({ ok: true, id });
  } catch (err) {
    return errorResponse('Failed to submit your channel — please try again.', 500);
  }
}
