import { json, errorResponse, readJsonBody } from '../../../../shared/http.js';

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const category = await env.DB.prepare('SELECT slug FROM categories WHERE slug = ?').bind(params.slug).first();
  if (!category) return errorResponse('Category not found.', 404);

  const body = await readJsonBody(request);
  if (!body) return errorResponse('Invalid request body.', 400);

  const setClauses = [];
  const values = [];
  if (body.label !== undefined) {
    setClauses.push('label = ?');
    values.push(body.label);
  }
  if (body.sortOrder !== undefined) {
    setClauses.push('sort_order = ?');
    values.push(Number(body.sortOrder) || 0);
  }
  if (body.active !== undefined) {
    setClauses.push('active = ?');
    values.push(body.active ? 1 : 0);
  }
  if (!setClauses.length) return errorResponse('Nothing to update.', 400);

  values.push(params.slug);
  await env.DB.prepare(`UPDATE categories SET ${setClauses.join(', ')} WHERE slug = ?`).bind(...values).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const category = await env.DB.prepare('SELECT slug FROM categories WHERE slug = ?').bind(params.slug).first();
  if (!category) return errorResponse('Category not found.', 404);

  // Soft delete (deactivate) rather than a hard DELETE — videos already
  // tagged with this category slug should keep displaying, just not be
  // offered as a choice for new/edited videos going forward.
  await env.DB.prepare('UPDATE categories SET active = 0 WHERE slug = ?').bind(params.slug).run();
  return json({ ok: true });
}
