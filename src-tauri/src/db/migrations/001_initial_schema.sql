-- Initial schema for POE Watcher

-- Speedrun attempts
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    class TEXT NOT NULL,
    ascendancy TEXT,
    league TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'any%',
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    total_time_ms INTEGER,
    is_completed INTEGER NOT NULL DEFAULT 0,
    is_personal_best INTEGER NOT NULL DEFAULT 0
);

-- Split times at breakpoints
CREATE TABLE IF NOT EXISTS splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    breakpoint_type TEXT NOT NULL,
    breakpoint_name TEXT NOT NULL,
    split_time_ms INTEGER NOT NULL,
    delta_ms INTEGER,
    segment_time_ms INTEGER NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- Character state snapshots
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    split_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    elapsed_time_ms INTEGER NOT NULL,
    character_level INTEGER NOT NULL,
    items_json TEXT NOT NULL DEFAULT '[]',
    skills_json TEXT NOT NULL DEFAULT '[]',
    passive_tree_json TEXT NOT NULL DEFAULT '{}',
    stats_json TEXT NOT NULL DEFAULT '{}',
    pob_code TEXT,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
    FOREIGN KEY (split_id) REFERENCES splits(id) ON DELETE CASCADE
);

-- Personal bests per category
CREATE TABLE IF NOT EXISTS personal_bests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    class TEXT NOT NULL,
    run_id INTEGER NOT NULL,
    total_time_ms INTEGER NOT NULL,
    UNIQUE(category, class),
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- Best segment times (gold splits)
CREATE TABLE IF NOT EXISTS gold_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    breakpoint_name TEXT NOT NULL,
    best_segment_ms INTEGER NOT NULL,
    UNIQUE(category, breakpoint_name)
);

-- Application settings
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    poe_log_path TEXT NOT NULL DEFAULT '',
    account_name TEXT NOT NULL DEFAULT '',
    overlay_enabled INTEGER NOT NULL DEFAULT 0,
    overlay_opacity REAL NOT NULL DEFAULT 0.8,
    sound_enabled INTEGER NOT NULL DEFAULT 1
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_category_class ON runs(category, class);
CREATE INDEX IF NOT EXISTS idx_splits_run_id ON splits(run_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_run_id ON snapshots(run_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_split_id ON snapshots(split_id);
