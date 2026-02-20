-- Group mode: persistent group members
CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT NOT NULL,
    character_name TEXT,
    display_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Group mode: snapshots for group members at breakpoints
CREATE TABLE IF NOT EXISTS group_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    split_id INTEGER NOT NULL,
    group_member_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    elapsed_time_ms INTEGER NOT NULL,
    character_level INTEGER NOT NULL DEFAULT 1,
    character_name TEXT NOT NULL DEFAULT '',
    account_name TEXT NOT NULL DEFAULT '',
    items_json TEXT NOT NULL DEFAULT '[]',
    skills_json TEXT NOT NULL DEFAULT '[]',
    passive_tree_json TEXT NOT NULL DEFAULT '{}',
    stats_json TEXT NOT NULL DEFAULT '{}',
    pob_code TEXT,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
    FOREIGN KEY (split_id) REFERENCES splits(id) ON DELETE CASCADE,
    FOREIGN KEY (group_member_id) REFERENCES group_members(id) ON DELETE CASCADE
);

-- Add group_mode_enabled to settings
ALTER TABLE settings ADD COLUMN group_mode_enabled INTEGER NOT NULL DEFAULT 0;

-- Add is_group_run to runs
ALTER TABLE runs ADD COLUMN is_group_run INTEGER NOT NULL DEFAULT 0;

-- Indexes for group snapshots
CREATE INDEX IF NOT EXISTS idx_group_snapshots_run_id ON group_snapshots(run_id);
CREATE INDEX IF NOT EXISTS idx_group_snapshots_split_id ON group_snapshots(split_id);
CREATE INDEX IF NOT EXISTS idx_group_snapshots_member_id ON group_snapshots(group_member_id);
CREATE INDEX IF NOT EXISTS idx_group_members_active ON group_members(is_active);
