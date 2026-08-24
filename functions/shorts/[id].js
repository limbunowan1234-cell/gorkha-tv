import { renderShortsPage } from '../../shared/render-shorts-page.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.pathname.split('/shorts/')[1];
  return renderShortsPage(env, url, id);
}
