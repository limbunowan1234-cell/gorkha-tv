-- Creator verification tier from the Gorkha TV Brand Pack's badge system —
-- admin-settable. Independent of the existing plain `verified` boolean: a
-- channel can be verified with no tier, or hold both.
ALTER TABLE channels ADD COLUMN tier TEXT;
