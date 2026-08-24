import { renderShortsPage } from '../shared/render-shorts-page.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  return renderShortsPage(env, url, null);
}
