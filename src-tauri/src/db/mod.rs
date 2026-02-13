mod schema;

use anyhow::Result;
use once_cell::sync::OnceCell;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub use schema::{
    Run, NewRun, RunFilters, RunStats, ReferenceRunData,
    Split, NewSplit, SplitStat,
    Snapshot, NewSnapshot,
    PersonalBest, GoldSplit, Settings,
};

static DB: OnceCell<Mutex<Connection>> = OnceCell::new();

/// Initialize the database connection
pub fn init_db(app_data_dir: PathBuf) -> Result<()> {
    let db_path = app_data_dir.join("poe_watcher.db");

    // Create parent directories if they don't exist
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let conn = Connection::open(&db_path)?;

    // Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON", [])?;

    // Run migrations
    run_migrations(&conn)?;

    DB.set(Mutex::new(conn))
        .map_err(|_| anyhow::anyhow!("Database already initialized"))?;

    Ok(())
}

/// Get a reference to the database connection
pub fn get_db() -> Result<std::sync::MutexGuard<'static, Connection>> {
    DB.get()
        .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?
        .lock()
        .map_err(|_| anyhow::anyhow!("Failed to lock database"))
}

/// Run database migrations
fn run_migrations(conn: &Connection) -> Result<()> {
    // Create migrations table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    // Check which migrations have been applied
    let mut stmt = conn.prepare("SELECT name FROM migrations")?;
    let applied: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    // Apply pending migrations
    for (name, sql) in MIGRATIONS {
        if !applied.contains(&name.to_string()) {
            conn.execute_batch(sql)?;
            conn.execute("INSERT INTO migrations (name) VALUES (?1)", [name])?;
        }
    }

    Ok(())
}

/// Database migrations
const MIGRATIONS: &[(&str, &str)] = &[
    ("001_initial_schema", include_str!("migrations/001_initial_schema.sql")),
    ("002_add_breakpoint_tracking", include_str!("migrations/002_add_breakpoint_tracking.sql")),
    ("003_add_overlay_position", include_str!("migrations/003_add_overlay_position.sql")),
    ("004_add_overlay_config", include_str!("migrations/004_add_overlay_config.sql")),
    ("005_update_overlay_defaults", include_str!("migrations/005_update_overlay_defaults.sql")),
    ("006_add_hotkey_settings", include_str!("migrations/006_add_hotkey_settings.sql")),
    ("007_add_manual_split_hotkey", include_str!("migrations/007_add_manual_split_hotkey.sql")),
];
