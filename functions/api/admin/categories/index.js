import { json, errorResponse, readJsonBody } from '../../../../shared/http.js';

export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare('SELECT * FROM categories ORDER BY sort_order, label').all();
  return json({ categories: results });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJsonBody(request);
  const slug = body?.slug?.trim().toLowerCase();
  const label = body?.label?.trim();
  if (!slug || !label) return errorResponse('slug and label are required.', 400);
  if (!/^[a-z0-9-]+$/.test(slug)) return errorResponse('slug must be lowercase letters, numbers, and hyphens only.', 400);

  const existing = await env.DB.prepare('SELECT slug FROM categories WHERE slug = ?').bind(slug).first();
  if (existing) return errorResponse('A category with this slug already exists.', 409);

  await env.DB.prepare('INSERT INTO categories (slug, label, sort_order, active) VALUES (?, ?, ?, 1)')
    .bind(slug, label, Number(body?.sortOrder) || 0)
    .run();

  return json({ ok: true, slug });
}
