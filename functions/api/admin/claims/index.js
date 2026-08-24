import { json } from '../../../../shared/http.js';
import { listChannelClaims } from '../../../../shared/db.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const claims = await listChannelClaims(env.DB, status);
  return json({ claims });
}
