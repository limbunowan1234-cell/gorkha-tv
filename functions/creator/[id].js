// /creator/:id is the old URL scheme — every channel's canonical URL is now
// its root-level slug (functions/[slug].js), so this route just 301s there.
// Kept working (rather than removed) so anything already shared/bookmarked/
// indexed under the old URL doesn't break.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = decodeURIComponent(url.pathname.split('/creator/')[1] || '');

  if (!id) return new Response('Not found.', { status: 404 });

  try {
    const creator = await env.DB.prepare(`SELECT slug FROM channels WHERE youtube_channel_id = ? AND status = 'approved'`).bind(id).first();
    if (creator?.slug) {
      return Response.redirect(`${url.origin}/${creator.slug}`, 301);
    }
  } catch (err) {
    // fall through to 404 below
  }

  return new Response('Not found.', { status: 404 });
}
