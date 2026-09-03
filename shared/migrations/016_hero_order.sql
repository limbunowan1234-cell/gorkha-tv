-- Phase L: explicit admin-controlled ordering for the homepage hero carousel.
-- Nullable — only videos an admin has explicitly ranked get a value; every
-- other featured=1 video stays NULL and keeps the old published_at-DESC
-- fallback order, sorted after the explicitly-ranked ones.
ALTER TABLE videos ADD COLUMN hero_order INTEGER;
