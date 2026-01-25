use crate::api_client::PoeApiClient;
use crate::db::{NewRun, NewSplit, NewSnapshot, PersonalBest, Run, Settings, Snapshot, Split, GoldSplit};
use crate::log_watcher::{detect_log_path, LogWatcher};
use anyhow::Result;
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

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

    // Stop any existing watcher first
    {
        let mut guard = get_log_watcher().lock().map_err(|e| e.to_string())?;
        if let Some(ref mut existing) = *guard {
            existing.stop();
        }
        *guard = None;
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

#[tauri::command]
pub async fn delete_run(run_id: i64) -> Result<(), String> {
    Run::delete(run_id).map_err(|e| e.to_string())
}

// ============================================================================
// Split Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddSplitRequest {
    pub split: NewSplit,
    pub capture_snapshot: bool,
    pub account_name: Option<String>,
    pub character_name: Option<String>,
}

#[tauri::command]
pub async fn add_split(
    app_handle: AppHandle,
    request: AddSplitRequest,
) -> Result<i64, String> {
    let split = request.split;
    let split_id = Split::insert(&split).map_err(|e| e.to_string())?;

    // Check if this is a gold split
    let run = Run::get_by_id(split.run_id).map_err(|e| e.to_string())?;
    if let Some(ref run) = run {
        let category = format!("{}", run.category);
        let _ = GoldSplit::update_if_better(&category, &split.breakpoint_name, split.segment_time_ms);
    }

    // Capture snapshot if requested
    if request.capture_snapshot {
        if let (Some(account_name), Some(character_name), Some(run)) =
            (request.account_name, request.character_name, run)
        {
            let handle = app_handle.clone();
            let run_id = run.id;
            let elapsed_time_ms = split.split_time_ms;

            // Emit capturing event
            let _ = handle.emit("snapshot-capturing", serde_json::json!({
                "split_id": split_id,
                "breakpoint_name": split.breakpoint_name,
            }));

            // Spawn async task to capture snapshot
            tokio::spawn(async move {
                capture_snapshot_for_split(
                    handle,
                    run_id,
                    split_id,
                    elapsed_time_ms,
                    account_name,
                    character_name,
                ).await;
            });
        }
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

/// Async function to capture a snapshot for a split
async fn capture_snapshot_for_split(
    app_handle: AppHandle,
    run_id: i64,
    split_id: i64,
    elapsed_time_ms: i64,
    account_name: String,
    character_name: String,
) {
    let client = get_api_client();

    // Fetch items
    let items_result = client.get_items(&account_name, &character_name).await;
    let (items_json, character_level) = match items_result {
        Ok(data) => {
            let items_json = serde_json::to_string(&data.items).unwrap_or_else(|_| "[]".to_string());
            (items_json, data.character.level as i32)
        }
        Err(e) => {
            let _ = app_handle.emit("snapshot-failed", serde_json::json!({
                "split_id": split_id,
                "error": e.to_string(),
            }));
            return;
        }
    };

    // Fetch passive skills
    let passives_result = client.get_passive_skills(&account_name, &character_name).await;
    let passive_tree_json = match passives_result {
        Ok(data) => serde_json::to_string(&data).unwrap_or_else(|_| "{}".to_string()),
        Err(e) => {
            let _ = app_handle.emit("snapshot-failed", serde_json::json!({
                "split_id": split_id,
                "error": e.to_string(),
            }));
            return;
        }
    };

    // Extract skills from socketed items (gems)
    let skills_json = "[]".to_string(); // Skills are in socketed_items within items_json

    // Create snapshot record
    let snapshot = NewSnapshot {
        run_id,
        split_id,
        timestamp: chrono::Utc::now().to_rfc3339(),
        elapsed_time_ms,
        character_level,
        items_json,
        skills_json,
        passive_tree_json,
        stats_json: "{}".to_string(),
        pob_code: None,
    };

    match Snapshot::insert(&snapshot) {
        Ok(snapshot_id) => {
            let _ = app_handle.emit("snapshot-complete", serde_json::json!({
                "split_id": split_id,
                "snapshot_id": snapshot_id,
                "character_level": character_level,
            }));
        }
        Err(e) => {
            let _ = app_handle.emit("snapshot-failed", serde_json::json!({
                "split_id": split_id,
                "error": e.to_string(),
            }));
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureSnapshotRequest {
    pub run_id: i64,
    pub split_id: i64,
    pub elapsed_time_ms: i64,
    pub account_name: String,
    pub character_name: String,
}

/// Manual snapshot capture command (for retry)
#[tauri::command]
pub async fn capture_snapshot(
    app_handle: AppHandle,
    request: CaptureSnapshotRequest,
) -> Result<(), String> {
    // Emit capturing event
    let _ = app_handle.emit("snapshot-capturing", serde_json::json!({
        "split_id": request.split_id,
    }));

    let handle = app_handle.clone();
    tokio::spawn(async move {
        capture_snapshot_for_split(
            handle,
            request.run_id,
            request.split_id,
            request.elapsed_time_ms,
            request.account_name,
            request.character_name,
        ).await;
    });

    Ok(())
}

#[tauri::command]
pub async fn create_snapshot(snapshot: NewSnapshot) -> Result<i64, String> {
    Snapshot::insert(&snapshot).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_snapshots(run_id: i64) -> Result<Vec<Snapshot>, String> {
    Snapshot::get_by_run(run_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_snapshot(snapshot_id: i64) -> Result<Option<Snapshot>, String> {
    Snapshot::get_by_id(snapshot_id).map_err(|e| e.to_string())
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

// ============================================================================
// Debug/Test Commands
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulateSnapshotRequest {
    pub account_name: String,
    pub character_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SimulateSnapshotResponse {
    pub run_id: i64,
    pub split_id: i64,
    pub snapshot_id: i64,
}

/// Simulate a snapshot capture for testing - creates a test run with snapshot data
#[tauri::command]
pub async fn simulate_snapshot(
    request: SimulateSnapshotRequest,
) -> Result<SimulateSnapshotResponse, String> {
    let client = get_api_client();

    // Fetch character data
    println!("[Simulate] Fetching character data for {}/{}", request.account_name, request.character_name);

    let items_data = client
        .get_items(&request.account_name, &request.character_name)
        .await
        .map_err(|e| format!("Failed to fetch items: {}", e))?;

    let passives_data = client
        .get_passive_skills(&request.account_name, &request.character_name)
        .await
        .map_err(|e| format!("Failed to fetch passives: {}", e))?;

    println!("[Simulate] Got {} items, {} passives", items_data.items.len(), passives_data.hashes.len());

    // The API's 'class' field contains either:
    // - A base class name (Marauder, Ranger, etc.) if not ascended
    // - An ascendancy name (Warden, Deadeye, etc.) if ascended
    // We need to derive the base class from the ascendancy name if applicable
    let class_name = &items_data.character.class;

    // Map ascendancy names to their base classes
    let (base_class, ascendancy) = match class_name.as_str() {
        // Base classes (no ascendancy)
        "Scion" | "Marauder" | "Ranger" | "Witch" | "Duelist" | "Templar" | "Shadow" => {
            (class_name.as_str(), None)
        }
        // Scion ascendancy
        "Ascendant" => ("Scion", Some(class_name.clone())),
        // Marauder ascendancies
        "Juggernaut" | "Berserker" | "Chieftain" => ("Marauder", Some(class_name.clone())),
        // Ranger ascendancies
        "Raider" | "Deadeye" | "Pathfinder" | "Warden" => ("Ranger", Some(class_name.clone())),
        // Witch ascendancies
        "Occultist" | "Elementalist" | "Necromancer" => ("Witch", Some(class_name.clone())),
        // Duelist ascendancies
        "Slayer" | "Gladiator" | "Champion" => ("Duelist", Some(class_name.clone())),
        // Templar ascendancies
        "Inquisitor" | "Hierophant" | "Guardian" => ("Templar", Some(class_name.clone())),
        // Shadow ascendancies
        "Assassin" | "Trickster" | "Saboteur" => ("Shadow", Some(class_name.clone())),
        // Unknown - default to treating as base class
        _ => (class_name.as_str(), None),
    };

    println!("[Simulate] API class: '{}' -> Base class: '{}', Ascendancy: {:?}",
        class_name, base_class, ascendancy);

    // Create a test run
    let new_run = NewRun {
        character_name: request.character_name.clone(),
        account_name: request.account_name.clone(),
        class: base_class.to_string(),
        ascendancy,
        league: items_data.character.league.clone(),
        category: "test".to_string(),
        started_at: chrono::Utc::now().to_rfc3339(),
    };

    let run_id = Run::insert(&new_run).map_err(|e| format!("Failed to create run: {}", e))?;
    println!("[Simulate] Created run {}", run_id);

    // Create a test split
    let new_split = NewSplit {
        run_id,
        breakpoint_type: "zone".to_string(),
        breakpoint_name: "Test Zone".to_string(),
        split_time_ms: 60000, // 1 minute
        delta_ms: None,
        segment_time_ms: 60000,
    };

    let split_id = Split::insert(&new_split).map_err(|e| format!("Failed to create split: {}", e))?;
    println!("[Simulate] Created split {}", split_id);

    // Create snapshot
    let items_json = serde_json::to_string(&items_data.items).unwrap_or_default();
    let passives_json = serde_json::to_string(&serde_json::json!({
        "hashes": passives_data.hashes,
        "hashes_ex": passives_data.hashes_ex,
    })).unwrap_or_default();

    println!("[Simulate] Items JSON length: {}, first 200 chars: {}",
        items_json.len(),
        items_json.chars().take(200).collect::<String>()
    );

    let new_snapshot = NewSnapshot {
        run_id,
        split_id,
        timestamp: chrono::Utc::now().to_rfc3339(),
        elapsed_time_ms: 60000,
        character_level: items_data.character.level as i32,
        items_json,
        skills_json: "[]".to_string(),
        passive_tree_json: passives_json,
        stats_json: "{}".to_string(),
        pob_code: None,
    };

    let snapshot_id = Snapshot::insert(&new_snapshot).map_err(|e| format!("Failed to create snapshot: {}", e))?;
    println!("[Simulate] Created snapshot {}", snapshot_id);

    Ok(SimulateSnapshotResponse {
        run_id,
        split_id,
        snapshot_id,
    })
}

// ============================================================================
// PoB Export Commands
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct PobbInResponse {
    pub url: String,
}

#[tauri::command]
pub async fn upload_to_pobbin(pob_code: String) -> Result<PobbInResponse, String> {
    let client = reqwest::Client::new();

    // pobb.in expects a POST to /pob with the raw PoB code as text/plain
    let response = client
        .post("https://pobb.in/pob")
        .header("Content-Type", "text/plain")
        .header("User-Agent", "POE-Watcher/0.1.0 (speedrun tracker)")
        .body(pob_code)
        .send()
        .await
        .map_err(|e| format!("Failed to upload: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;
    let text = text.trim();

    println!("[pobb.in] Status: {}, Response: {}", status, text);

    // Check for HTTP errors
    if !status.is_success() {
        return Err(format!("pobb.in error ({}): {}", status, text));
    }

    // pobb.in returns the ID directly as plain text (e.g., "WtDNCT-adpMf")
    // If it looks like an ID (alphanumeric with possible hyphen), use it directly
    if !text.is_empty() && !text.starts_with('{') && !text.starts_with('<') {
        return Ok(PobbInResponse {
            url: format!("https://pobb.in/{}", text),
        });
    }

    // Try parsing as JSON (fallback for future API changes)
    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&text) {
        // Check for error response
        if let Some(code) = data["code"].as_i64() {
            if code >= 400 {
                let message = data["message"].as_str().unwrap_or("Unknown error");
                return Err(format!("pobb.in error: {}", message));
            }
        }

        // Success - get the ID from response
        if let Some(id) = data["id"].as_str() {
            return Ok(PobbInResponse {
                url: format!("https://pobb.in/{}", id),
            });
        }

        // Also check for url field
        if let Some(url) = data["url"].as_str() {
            return Ok(PobbInResponse {
                url: url.to_string(),
            });
        }
    }

    Err(format!("pobb.in returned unexpected response ({}): {}",
        status,
        text.chars().take(200).collect::<String>()
    ))
}
