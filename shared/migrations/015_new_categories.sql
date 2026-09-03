-- Phase L: 3 new genre-oriented categories, so the homepage's new genre nav
-- links (Movies / Web Series / Short Films) each have a real category behind
-- them. News/Interviews/Vlogs/Travel already existed and are reused as-is.
INSERT OR IGNORE INTO categories (slug, label, sort_order) VALUES
  ('movies', 'Movies', 11), ('webseries', 'Web Series', 12), ('shortfilms', 'Short Films', 13);
