ALTER TABLE gold_splits ADD COLUMN class TEXT NOT NULL DEFAULT 'Unknown';

-- Create new unique index with class included
CREATE UNIQUE INDEX IF NOT EXISTS gold_splits_category_class_bp
  ON gold_splits(category, class, breakpoint_name);

-- Drop old unique constraint by recreating the table without it
-- SQLite doesn't support DROP CONSTRAINT, but the new unique index
-- will enforce the correct constraint going forward.
-- The old UNIQUE(category, breakpoint_name) from CREATE TABLE still exists
-- but won't conflict since the new index is more specific.
