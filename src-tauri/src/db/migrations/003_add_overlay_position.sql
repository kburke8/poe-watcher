-- Migration: Add overlay position persistence

ALTER TABLE settings ADD COLUMN overlay_x INTEGER;
ALTER TABLE settings ADD COLUMN overlay_y INTEGER;
