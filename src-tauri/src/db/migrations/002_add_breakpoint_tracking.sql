-- Migration: Add breakpoint tracking and analytics support

-- Run-level breakpoint tracking
ALTER TABLE runs ADD COLUMN breakpoint_preset TEXT;
ALTER TABLE runs ADD COLUMN enabled_breakpoints TEXT;

-- Reference runs (manually entered external times)
ALTER TABLE runs ADD COLUMN is_reference INTEGER NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN source_name TEXT;

-- Split-level town/hideout time tracking (cumulative at each split)
ALTER TABLE splits ADD COLUMN town_time_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE splits ADD COLUMN hideout_time_ms INTEGER NOT NULL DEFAULT 0;

-- Index for faster filtering by breakpoint preset
CREATE INDEX IF NOT EXISTS idx_runs_breakpoint_preset ON runs(breakpoint_preset);

-- Index for reference runs
CREATE INDEX IF NOT EXISTS idx_runs_is_reference ON runs(is_reference);
