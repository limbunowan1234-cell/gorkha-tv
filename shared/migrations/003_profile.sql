-- Viewer profile fields — a user can set a custom display name/bio separate
-- from what Google's ID token provides. NULL means "use Google's name/photo".
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
