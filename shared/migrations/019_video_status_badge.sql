-- Editorial status badge (LIVE/BREAKING/PREMIERE) from the Gorkha TV Brand
-- Pack's badge system — admin-settable only. TRENDING and NEW RELEASE
-- aren't stored here: they're computed at render time from videos.trending
-- and published_at, which already exist.
ALTER TABLE videos ADD COLUMN status_badge TEXT;
