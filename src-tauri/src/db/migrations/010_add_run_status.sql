-- Add status column to runs table
ALTER TABLE runs ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress';

-- Migrate existing data
UPDATE runs SET status = 'completed' WHERE is_completed = 1;
UPDATE runs SET status = 'abandoned' WHERE is_completed = 0;

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
