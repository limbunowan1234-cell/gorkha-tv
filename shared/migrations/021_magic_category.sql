-- 'magic' already exists as a category row (added via the admin, label "magic"
-- and sort_order 0, which sorted it ahead of News). Normalise its label/order
-- so it reads like every other category, and make sure it exists on any
-- database that never had it added by hand.
INSERT OR IGNORE INTO categories (slug, label, sort_order) VALUES ('magic', 'Magic', 15);
UPDATE categories SET label = 'Magic', sort_order = 15 WHERE slug = 'magic';
