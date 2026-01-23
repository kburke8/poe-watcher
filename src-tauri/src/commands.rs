use crate::api_client::PoeApiClient;
use crate::db::{NewRun, NewSplit, NewSnapshot, PersonalBest, Run, Settings, Snapshot, Split, GoldSplit};
use crate::log_watcher::{detect_log_path, LogWatcher};
use anyhow::Result;
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;

// Global state
static LOG_WATCHER: OnceCell<Mutex<Option<LogWatcher>>> = OnceCell::new();
static API_CLIENT: OnceCell<PoeApiClient> = OnceCell::new();

fn get_log_watcher() -> &'static Mutex<Option<LogWatcher>> {
    LOG_WATCHER.get_or_init(|| Mutex::new(None))
}

fn get_api_client() -> &'static PoeApiClient {
    API_CLIENT.get_or_init(PoeApiClient::new)
}

// ============================================================================
// Settings Commands
// ============================================================================

#[tauri::command]
pub async fn get_settings() -> Result<Settings, String> {
    Settings::load().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_settings(settings: Settings) -> Result<(), String> {
    Settings::save(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn detect_log_path_cmd() -> Result<Option<String>, String> {
    Ok(detect_log_path().map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn browse_log_path() -> Result<Option<String>, String> {
    // Note: In a real implementation, this would use tauri-plugin-dialog
    // For now, just return None to indicate the user should manually enter the path
    Ok(None)
}

// ============================================================================
// Log Watcher Commands
// ============================================================================

#[tauri::command]
pub async fn start_log_watcher(app_handle: AppHandle, log_path: String) -> Result<(), String> {
    let path = PathBuf::from(&log_path);
    if !path.exists() {
        return Err(format!("Log file not found: {}", log_path));
    }

    let mut watcher = LogWatcher::new(path);
    watcher.start(app_handle).map_err(|e| e.to_string())?;

    let mut guard = get_log_watcher().lock().map_err(|e| e.to_string())?;
    *guard = Some(watcher);

    Ok(())
}

#[tauri::command]
pub async fn stop_log_watcher() -> Result<(), String> {
    let mut guard = get_log_watcher().lock().map_err(|e| e.to_string())?;
    if let Some(ref mut watcher) = *guard {
        watcher.stop();
    }
    *guard = None;
    Ok(())
}

// ============================================================================
// Run Commands
// ============================================================================

#[tauri::command]
pub async fn create_run(run: NewRun) -> Result<i64, String> {
    Run::insert(&run).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn complete_run(run_id: i64, total_time_ms: i64) -> Result<bool, String> {
    Run::complete(run_id, total_time_ms).map_err(|e| e.to_string())?;

    // Check if this is a new personal best
    if let Ok(Some(run)) = Run::get_by_id(run_id) {
        let category = format!("{}", run.category);
        let is_pb = PersonalBest::get_or_create(&category, &run.class, run_id, total_time_ms)
            .map_err(|e| e.to_string())?;
        return Ok(is_pb);
    }

    Ok(false)
}

#[tauri::command]
pub async fn get_runs() -> Result<Vec<Run>, String> {
    Run::get_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_run(run_id: i64) -> Result<Option<Run>, String> {
    Run::get_by_id(run_id).map_err(|e| e.to_string())
}

// ============================================================================
// Split Commands
// ============================================================================

#[tauri::command]
pub async fn add_split(split: NewSplit) -> Result<i64, String> {
    let split_id = Split::insert(&split).map_err(|e| e.to_string())?;

    // Check if this is a gold split
    if let Ok(Some(run)) = Run::get_by_id(split.run_id) {
        let category = format!("{}", run.category);
        let _ = GoldSplit::update_if_better(&category, &split.breakpoint_name, split.segment_time_ms);
    }

    Ok(split_id)
}

#[tauri::command]
pub async fn get_splits(run_id: i64) -> Result<Vec<Split>, String> {
    Split::get_by_run(run_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn manual_split() -> Result<(), String> {
    // This is a placeholder - the actual split logic is handled by the frontend
    // when it receives breakpoint triggers from the log watcher
    Ok(())
}

// ============================================================================
// Snapshot Commands
// ============================================================================

#[tauri::command]
pub async fn create_snapshot(snapshot: NewSnapshot) -> Result<i64, String> {
    Snapshot::insert(&snapshot).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_snapshots(run_id: i64) -> Result<Vec<Snapshot>, String> {
    Snapshot::get_by_run(run_id).map_err(|e| e.to_string())
}

// ============================================================================
// Personal Best Commands
// ============================================================================

#[tauri::command]
pub async fn get_personal_bests() -> Result<Vec<PersonalBest>, String> {
    PersonalBest::get_all().map_err(|e| e.to_string())
}

// ============================================================================
// Gold Split Commands
// ============================================================================

#[tauri::command]
pub async fn get_gold_splits() -> Result<Vec<GoldSplit>, String> {
    GoldSplit::get_all().map_err(|e| e.to_string())
}

// ============================================================================
// API Commands
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterListResponse {
    pub characters: Vec<crate::api_client::PoeCharacter>,
}

#[tauri::command]
pub async fn fetch_characters(account_name: String) -> Result<CharacterListResponse, String> {
    let client = get_api_client();
    let characters = client
        .get_characters(&account_name)
        .await
        .map_err(|e| e.to_string())?;
    Ok(CharacterListResponse { characters })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CharacterDataResponse {
    pub items: Vec<crate::api_client::PoeItem>,
    pub level: u32,
    pub experience: u64,
}

#[tauri::command]
pub async fn fetch_character_data(
    account_name: String,
    character_name: String,
) -> Result<CharacterDataResponse, String> {
    let client = get_api_client();
    let data = client
        .get_items(&account_name, &character_name)
        .await
        .map_err(|e| e.to_string())?;

    Ok(CharacterDataResponse {
        items: data.items,
        level: data.character.level,
        experience: data.character.experience,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PassiveTreeResponse {
    pub hashes: Vec<u32>,
}

#[tauri::command]
pub async fn fetch_passive_tree(
    account_name: String,
    character_name: String,
) -> Result<PassiveTreeResponse, String> {
    let client = get_api_client();
    let data = client
        .get_passive_skills(&account_name, &character_name)
        .await
        .map_err(|e| e.to_string())?;

    Ok(PassiveTreeResponse { hashes: data.hashes })
}
