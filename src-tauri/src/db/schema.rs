use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};

use super::get_db;
use anyhow::Result;

// ============================================================================
// Run
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Run {
    pub id: i64,
    pub character_name: String,
    pub account_name: String,
    pub class: String,
    pub ascendancy: Option<String>,
    pub league: String,
    pub category: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub total_time_ms: Option<i64>,
    pub is_completed: bool,
    pub is_personal_best: bool,
    // Breakpoint tracking
    pub breakpoint_preset: Option<String>,
    pub enabled_breakpoints: Option<String>,
    // Reference run support
    pub is_reference: bool,
    pub source_name: Option<String>,
}

impl Run {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Run {
            id: row.get("id")?,
            character_name: row.get("character_name")?,
            account_name: row.get("account_name")?,
            class: row.get("class")?,
            ascendancy: row.get("ascendancy")?,
            league: row.get("league")?,
            category: row.get("category")?,
            started_at: row.get("started_at")?,
            ended_at: row.get("ended_at")?,
            total_time_ms: row.get("total_time_ms")?,
            is_completed: row.get("is_completed")?,
            is_personal_best: row.get("is_personal_best")?,
            breakpoint_preset: row.get("breakpoint_preset")?,
            enabled_breakpoints: row.get("enabled_breakpoints")?,
            is_reference: row.get("is_reference")?,
            source_name: row.get("source_name")?,
        })
    }

    pub fn insert(run: &NewRun) -> Result<i64> {
        let conn = get_db()?;
        conn.execute(
            "INSERT INTO runs (character_name, account_name, class, ascendancy, league, category, started_at, breakpoint_preset, enabled_breakpoints)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                run.character_name,
                run.account_name,
                run.class,
                run.ascendancy,
                run.league,
                run.category,
                run.started_at,
                run.breakpoint_preset,
                run.enabled_breakpoints,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn complete(id: i64, total_time_ms: i64) -> Result<()> {
        let conn = get_db()?;
        conn.execute(
            "UPDATE runs SET is_completed = 1, ended_at = datetime('now'), total_time_ms = ?1 WHERE id = ?2",
            params![total_time_ms, id],
        )?;
        Ok(())
    }

    pub fn update_character(id: i64, character_name: &str, class: &str) -> Result<()> {
        let conn = get_db()?;
        conn.execute(
            "UPDATE runs SET character_name = ?1, class = ?2 WHERE id = ?3",
            params![character_name, class, id],
        )?;
        Ok(())
    }

    pub fn get_all() -> Result<Vec<Run>> {
        let conn = get_db()?;
        let mut stmt = conn.prepare("SELECT * FROM runs ORDER BY started_at DESC")?;
        let runs = stmt
            .query_map([], Run::from_row)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(runs)
    }

    pub fn get_by_id(id: i64) -> Result<Option<Run>> {
        let conn = get_db()?;
        let mut stmt = conn.prepare("SELECT * FROM runs WHERE id = ?1")?;
        let run = stmt.query_row([id], Run::from_row).ok();
        Ok(run)
    }

    pub fn delete(id: i64) -> Result<()> {
        let conn = get_db()?;
        // Delete associated snapshots first
        conn.execute("DELETE FROM snapshots WHERE run_id = ?1", params![id])?;
        // Delete associated splits
        conn.execute("DELETE FROM splits WHERE run_id = ?1", params![id])?;
        // Delete the run
        conn.execute("DELETE FROM runs WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Update class and ascendancy for a run (used when API data is fetched)
    pub fn update_class_info(id: i64, class: &str, ascendancy: Option<&str>, league: Option<&str>) -> Result<()> {
        let conn = get_db()?;

        // Update class if it's 'Unknown'
        conn.execute(
            "UPDATE runs SET class = ?1 WHERE id = ?2 AND class = 'Unknown'",
            params![class, id],
        )?;

        // Update ascendancy if it's NULL (even if class was already set)
        if let Some(asc) = ascendancy {
            conn.execute(
                "UPDATE runs SET ascendancy = ?1 WHERE id = ?2 AND ascendancy IS NULL",
                params![asc, id],
            )?;
        }

        // Update league if provided and current league is empty
        if let Some(lg) = league {
            conn.execute(
                "UPDATE runs SET league = ?1 WHERE id = ?2 AND (league IS NULL OR league = '')",
                params![lg, id],
            )?;
        }

        Ok(())
    }

    /// Get runs filtered by various criteria
    pub fn get_filtered(filters: &RunFilters) -> Result<Vec<Run>> {
        let conn = get_db()?;

        let mut sql = String::from("SELECT * FROM runs WHERE 1=1");
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref class) = filters.class {
            sql.push_str(" AND class = ?");
            params_vec.push(Box::new(class.clone()));
        }

        if let Some(ref ascendancy) = filters.ascendancy {
            sql.push_str(" AND ascendancy = ?");
            params_vec.push(Box::new(ascendancy.clone()));
        }

        if let Some(ref category) = filters.category {
            sql.push_str(" AND category = ?");
            params_vec.push(Box::new(category.clone()));
        }

        if let Some(ref league) = filters.league {
            sql.push_str(" AND league = ?");
            params_vec.push(Box::new(league.clone()));
        }

        if let Some(ref preset) = filters.breakpoint_preset {
            sql.push_str(" AND breakpoint_preset = ?");
            params_vec.push(Box::new(preset.clone()));
        }

        if let Some(completed) = filters.is_completed {
            sql.push_str(" AND is_completed = ?");
            params_vec.push(Box::new(completed as i32));
        }

        if let Some(reference) = filters.include_reference {
            if !reference {
                sql.push_str(" AND is_reference = 0");
            }
        } else {
            // By default, exclude reference runs
            sql.push_str(" AND is_reference = 0");
        }

        sql.push_str(" ORDER BY started_at DESC");

        let mut stmt = conn.prepare(&sql)?;
        let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let runs = stmt
            .query_map(params_refs.as_slice(), Run::from_row)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(runs)
    }

    /// Get statistics for runs matching the given filters
    pub fn get_stats(filters: &RunFilters) -> Result<RunStats> {
        let runs = Run::get_filtered(filters)?;

        let total_runs = runs.len() as i64;
        let completed_runs: Vec<&Run> = runs.iter().filter(|r| r.is_completed).collect();
        let completed_count = completed_runs.len() as i64;

        let completed_times: Vec<i64> = completed_runs
            .iter()
            .filter_map(|r| r.total_time_ms)
            .collect();

        let average_time_ms = if !completed_times.is_empty() {
            Some(completed_times.iter().sum::<i64>() / completed_times.len() as i64)
        } else {
            None
        };

        let best_time_ms = completed_times.iter().min().copied();

        Ok(RunStats {
            total_runs,
            completed_runs: completed_count,
            average_time_ms,
            best_time_ms,
        })
    }

    /// Insert a reference run (manually entered external times)
    pub fn insert_reference(data: &ReferenceRunData) -> Result<i64> {
        let conn = get_db()?;
        conn.execute(
            "INSERT INTO runs (character_name, account_name, class, ascendancy, league, category, started_at, breakpoint_preset, enabled_breakpoints, is_reference, source_name, is_completed, total_time_ms)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), ?7, ?8, 1, ?9, 1, ?10)",
            params![
                data.character_name.clone().unwrap_or_default(),
                "",
                data.class,
                data.ascendancy,
                data.league.clone().unwrap_or_else(|| "Standard".to_string()),
                data.category,
                data.breakpoint_preset,
                data.enabled_breakpoints,
                data.source_name,
                data.total_time_ms,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }
}

/// Filters for querying runs
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunFilters {
    pub class: Option<String>,
    pub ascendancy: Option<String>,
    pub category: Option<String>,
    pub league: Option<String>,
    pub breakpoint_preset: Option<String>,
    pub is_completed: Option<bool>,
    pub include_reference: Option<bool>,
}

/// Statistics for a set of runs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunStats {
    pub total_runs: i64,
    pub completed_runs: i64,
    pub average_time_ms: Option<i64>,
    pub best_time_ms: Option<i64>,
}

/// Statistics for a specific breakpoint across multiple runs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitStat {
    pub breakpoint_name: String,
    pub average_time_ms: i64,
    pub best_time_ms: i64,
    pub average_town_time_ms: i64,
    pub run_count: i64,
}

/// Data for creating a reference run
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceRunData {
    pub source_name: String,
    pub character_name: Option<String>,
    pub class: String,
    pub ascendancy: Option<String>,
    pub category: String,
    pub league: Option<String>,
    pub breakpoint_preset: Option<String>,
    pub enabled_breakpoints: Option<String>,
    pub total_time_ms: i64,
    pub splits: Vec<ReferenceSplitData>,
}

/// Data for a split in a reference run
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceSplitData {
    pub breakpoint_name: String,
    pub breakpoint_type: String,
    pub split_time_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewRun {
    pub character_name: String,
    pub account_name: String,
    pub class: String,
    pub ascendancy: Option<String>,
    pub league: String,
    pub category: String,
    pub started_at: String,
    // Breakpoint tracking
    #[serde(default)]
    pub breakpoint_preset: Option<String>,
    #[serde(default)]
    pub enabled_breakpoints: Option<String>,
}

// ============================================================================
// Split
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Split {
    pub id: i64,
    pub run_id: i64,
    pub breakpoint_type: String,
    pub breakpoint_name: String,
    pub split_time_ms: i64,
    pub delta_ms: Option<i64>,
    pub segment_time_ms: i64,
    // Town/hideout time tracking (cumulative at this split)
    pub town_time_ms: i64,
    pub hideout_time_ms: i64,
}

impl Split {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Split {
            id: row.get("id")?,
            run_id: row.get("run_id")?,
            breakpoint_type: row.get("breakpoint_type")?,
            breakpoint_name: row.get("breakpoint_name")?,
            split_time_ms: row.get("split_time_ms")?,
            delta_ms: row.get("delta_ms")?,
            segment_time_ms: row.get("segment_time_ms")?,
            town_time_ms: row.get("town_time_ms")?,
            hideout_time_ms: row.get("hideout_time_ms")?,
        })
    }

    pub fn insert(split: &NewSplit) -> Result<i64> {
        let conn = get_db()?;
        conn.execute(
            "INSERT INTO splits (run_id, breakpoint_type, breakpoint_name, split_time_ms, delta_ms, segment_time_ms, town_time_ms, hideout_time_ms)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                split.run_id,
                split.breakpoint_type,
                split.breakpoint_name,
                split.split_time_ms,
                split.delta_ms,
                split.segment_time_ms,
                split.town_time_ms,
                split.hideout_time_ms,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_by_run(run_id: i64) -> Result<Vec<Split>> {
        let conn = get_db()?;
        let mut stmt = conn.prepare("SELECT * FROM splits WHERE run_id = ?1 ORDER BY split_time_ms")?;
        let splits = stmt
            .query_map([run_id], Split::from_row)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(splits)
    }

    /// Get split statistics for runs matching the given filters
    pub fn get_stats(filters: &RunFilters) -> Result<Vec<SplitStat>> {
        let runs = Run::get_filtered(filters)?;
        if runs.is_empty() {
            return Ok(Vec::new());
        }

        // Collect all splits for matching runs
        let mut splits_by_breakpoint: std::collections::HashMap<String, Vec<Split>> =
            std::collections::HashMap::new();

        for run in &runs {
            if let Ok(splits) = Split::get_by_run(run.id) {
                for split in splits {
                    splits_by_breakpoint
                        .entry(split.breakpoint_name.clone())
                        .or_default()
                        .push(split);
                }
            }
        }

        // Calculate stats for each breakpoint
        let mut stats: Vec<SplitStat> = splits_by_breakpoint
            .into_iter()
            .map(|(name, splits)| {
                let count = splits.len() as i64;
                let total_time: i64 = splits.iter().map(|s| s.split_time_ms).sum();
                let total_town: i64 = splits.iter().map(|s| s.town_time_ms).sum();
                let best_time = splits.iter().map(|s| s.split_time_ms).min().unwrap_or(0);

                SplitStat {
                    breakpoint_name: name,
                    average_time_ms: total_time / count,
                    best_time_ms: best_time,
                    average_town_time_ms: total_town / count,
                    run_count: count,
                }
            })
            .collect();

        // Sort by average time
        stats.sort_by(|a, b| a.average_time_ms.cmp(&b.average_time_ms));

        Ok(stats)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSplit {
    pub run_id: i64,
    pub breakpoint_type: String,
    pub breakpoint_name: String,
    pub split_time_ms: i64,
    pub delta_ms: Option<i64>,
    pub segment_time_ms: i64,
    // Town/hideout time tracking (cumulative at this split)
    #[serde(default)]
    pub town_time_ms: i64,
    #[serde(default)]
    pub hideout_time_ms: i64,
}

// ============================================================================
// Snapshot
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: i64,
    pub run_id: i64,
    pub split_id: i64,
    pub timestamp: String,
    pub elapsed_time_ms: i64,
    pub character_level: i32,
    pub items_json: String,
    pub skills_json: String,
    pub passive_tree_json: String,
    pub stats_json: String,
    pub pob_code: Option<String>,
}

impl Snapshot {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Snapshot {
            id: row.get("id")?,
            run_id: row.get("run_id")?,
            split_id: row.get("split_id")?,
            timestamp: row.get("timestamp")?,
            elapsed_time_ms: row.get("elapsed_time_ms")?,
            character_level: row.get("character_level")?,
            items_json: row.get("items_json")?,
            skills_json: row.get("skills_json")?,
            passive_tree_json: row.get("passive_tree_json")?,
            stats_json: row.get("stats_json")?,
            pob_code: row.get("pob_code")?,
        })
    }

    pub fn insert(snapshot: &NewSnapshot) -> Result<i64> {
        let conn = get_db()?;
        conn.execute(
            "INSERT INTO snapshots (run_id, split_id, timestamp, elapsed_time_ms, character_level, items_json, skills_json, passive_tree_json, stats_json, pob_code)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                snapshot.run_id,
                snapshot.split_id,
                snapshot.timestamp,
                snapshot.elapsed_time_ms,
                snapshot.character_level,
                snapshot.items_json,
                snapshot.skills_json,
                snapshot.passive_tree_json,
                snapshot.stats_json,
                snapshot.pob_code,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_by_run(run_id: i64) -> Result<Vec<Snapshot>> {
        let conn = get_db()?;
        let mut stmt = conn.prepare("SELECT * FROM snapshots WHERE run_id = ?1 ORDER BY elapsed_time_ms")?;
        let snapshots = stmt
            .query_map([run_id], Snapshot::from_row)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(snapshots)
    }

    pub fn get_by_id(id: i64) -> Result<Option<Snapshot>> {
        let conn = get_db()?;
        let mut stmt = conn.prepare("SELECT * FROM snapshots WHERE id = ?1")?;
        let snapshot = stmt.query_row([id], Snapshot::from_row).ok();
        Ok(snapshot)
    }

    pub fn get_by_split(split_id: i64) -> Result<Option<Snapshot>> {
        let conn = get_db()?;
        let mut stmt = conn.prepare("SELECT * FROM snapshots WHERE split_id = ?1")?;
        let snapshot = stmt.query_row([split_id], Snapshot::from_row).ok();
        Ok(snapshot)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewSnapshot {
    pub run_id: i64,
    pub split_id: i64,
    pub timestamp: String,
    pub elapsed_time_ms: i64,
    pub character_level: i32,
    pub items_json: String,
    pub skills_json: String,
    pub passive_tree_json: String,
    pub stats_json: String,
    pub pob_code: Option<String>,
}

// ============================================================================
// Personal Best
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalBest {
    pub id: i64,
    pub category: String,
    pub class: String,
    pub run_id: i64,
    pub total_time_ms: i64,
}

impl PersonalBest {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(PersonalBest {
            id: row.get("id")?,
            category: row.get("category")?,
            class: row.get("class")?,
            run_id: row.get("run_id")?,
            total_time_ms: row.get("total_time_ms")?,
        })
    }

    pub fn get_or_create(category: &str, class: &str, run_id: i64, total_time_ms: i64) -> Result<bool> {
        let conn = get_db()?;

        // Check if there's an existing PB
        let existing: Option<i64> = conn
            .query_row(
                "SELECT total_time_ms FROM personal_bests WHERE category = ?1 AND class = ?2",
                params![category, class],
                |row| row.get(0),
            )
            .ok();

        match existing {
            Some(existing_time) if total_time_ms < existing_time => {
                // New PB!
                conn.execute(
                    "UPDATE personal_bests SET run_id = ?1, total_time_ms = ?2 WHERE category = ?3 AND class = ?4",
                    params![run_id, total_time_ms, category, class],
                )?;
                Ok(true)
            }
            None => {
                // First run in this category
                conn.execute(
                    "INSERT INTO personal_bests (category, class, run_id, total_time_ms) VALUES (?1, ?2, ?3, ?4)",
                    params![category, class, run_id, total_time_ms],
                )?;
                Ok(true)
            }
            _ => Ok(false),
        }
    }

    pub fn get_all() -> Result<Vec<PersonalBest>> {
        let conn = get_db()?;
        let mut stmt = conn.prepare("SELECT * FROM personal_bests")?;
        let pbs = stmt
            .query_map([], PersonalBest::from_row)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(pbs)
    }
}

// ============================================================================
// Gold Split
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoldSplit {
    pub id: i64,
    pub category: String,
    pub breakpoint_name: String,
    pub best_segment_ms: i64,
}

impl GoldSplit {
    pub fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(GoldSplit {
            id: row.get("id")?,
            category: row.get("category")?,
            breakpoint_name: row.get("breakpoint_name")?,
            best_segment_ms: row.get("best_segment_ms")?,
        })
    }

    pub fn update_if_better(category: &str, breakpoint_name: &str, segment_ms: i64) -> Result<bool> {
        let conn = get_db()?;

        let existing: Option<i64> = conn
            .query_row(
                "SELECT best_segment_ms FROM gold_splits WHERE category = ?1 AND breakpoint_name = ?2",
                params![category, breakpoint_name],
                |row| row.get(0),
            )
            .ok();

        match existing {
            Some(existing_time) if segment_ms < existing_time => {
                conn.execute(
                    "UPDATE gold_splits SET best_segment_ms = ?1 WHERE category = ?2 AND breakpoint_name = ?3",
                    params![segment_ms, category, breakpoint_name],
                )?;
                Ok(true)
            }
            None => {
                conn.execute(
                    "INSERT INTO gold_splits (category, breakpoint_name, best_segment_ms) VALUES (?1, ?2, ?3)",
                    params![category, breakpoint_name, segment_ms],
                )?;
                Ok(true)
            }
            _ => Ok(false),
        }
    }

    pub fn get_all() -> Result<Vec<GoldSplit>> {
        let conn = get_db()?;
        let mut stmt = conn.prepare("SELECT * FROM gold_splits")?;
        let golds = stmt
            .query_map([], GoldSplit::from_row)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(golds)
    }
}

// ============================================================================
// Settings
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub poe_log_path: String,
    pub account_name: String,
    pub overlay_enabled: bool,
    pub overlay_opacity: f64,
    pub sound_enabled: bool,
    pub overlay_x: Option<i32>,
    pub overlay_y: Option<i32>,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            poe_log_path: String::new(),
            account_name: String::new(),
            overlay_enabled: false,
            overlay_opacity: 0.8,
            sound_enabled: true,
            overlay_x: None,
            overlay_y: None,
        }
    }
}

impl Settings {
    pub fn load() -> Result<Settings> {
        let conn = get_db()?;
        let result = conn.query_row(
            "SELECT poe_log_path, account_name, overlay_enabled, overlay_opacity, sound_enabled, overlay_x, overlay_y FROM settings WHERE id = 1",
            [],
            |row| {
                Ok(Settings {
                    poe_log_path: row.get(0)?,
                    account_name: row.get(1)?,
                    overlay_enabled: row.get(2)?,
                    overlay_opacity: row.get(3)?,
                    sound_enabled: row.get(4)?,
                    overlay_x: row.get(5)?,
                    overlay_y: row.get(6)?,
                })
            },
        );

        match result {
            Ok(settings) => Ok(settings),
            Err(_) => Ok(Settings::default()),
        }
    }

    pub fn save(settings: &Settings) -> Result<()> {
        let conn = get_db()?;
        conn.execute(
            "INSERT INTO settings (id, poe_log_path, account_name, overlay_enabled, overlay_opacity, sound_enabled, overlay_x, overlay_y)
             VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                poe_log_path = excluded.poe_log_path,
                account_name = excluded.account_name,
                overlay_enabled = excluded.overlay_enabled,
                overlay_opacity = excluded.overlay_opacity,
                sound_enabled = excluded.sound_enabled,
                overlay_x = excluded.overlay_x,
                overlay_y = excluded.overlay_y",
            params![
                settings.poe_log_path,
                settings.account_name,
                settings.overlay_enabled,
                settings.overlay_opacity,
                settings.sound_enabled,
                settings.overlay_x,
                settings.overlay_y,
            ],
        )?;
        Ok(())
    }

    pub fn save_overlay_position(x: i32, y: i32) -> Result<()> {
        let conn = get_db()?;
        conn.execute(
            "UPDATE settings SET overlay_x = ?1, overlay_y = ?2 WHERE id = 1",
            params![x, y],
        )?;
        Ok(())
    }

    pub fn get_overlay_position() -> Result<(Option<i32>, Option<i32>)> {
        let conn = get_db()?;
        let result = conn.query_row(
            "SELECT overlay_x, overlay_y FROM settings WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        );
        match result {
            Ok(pos) => Ok(pos),
            Err(_) => Ok((None, None)),
        }
    }
}
