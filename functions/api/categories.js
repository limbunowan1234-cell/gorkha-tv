import { cacheableJson, errorResponse } from '../../shared/http.js';

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare('SELECT slug, label, sort_order FROM categories WHERE active = 1 ORDER BY sort_order, label').all();
    return cacheableJson({ categories: results }, 300); // changes rarely (admin-only) — longer TTL
  } catch (err) {
    return errorResponse('Categories are temporarily unavailable.', 503);
  }
}
