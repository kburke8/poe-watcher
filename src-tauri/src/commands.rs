use crate::api_client::PoeApiClient;
use crate::db::{
    NewRun, NewSplit, NewSnapshot, PersonalBest, Run, Settings, Snapshot, Split, GoldSplit,
    RunFilters, RunStats, SplitStat, ReferenceRunData,
};
use crate::log_watcher::{detect_log_path, LogWatcher};
use anyhow::Result;
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

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

#[tauri::command]
pub async fn set_log_poll_fast(enabled: bool) -> Result<(), String> {
    let guard = get_log_watcher().lock().map_err(|e| e.to_string())?;
    if let Some(ref watcher) = *guard {
        watcher.set_fast_polling(enabled);
    }
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
pub async fn update_run_character(run_id: i64, character_name: String, class: String) -> Result<(), String> {
    Run::update_character(run_id, &character_name, &class).map_err(|e| e.to_string())
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

#[tauri::command]
pub async fn get_runs_filtered(filters: RunFilters) -> Result<Vec<Run>, String> {
    Run::get_filtered(&filters).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_run_stats(filters: RunFilters) -> Result<RunStats, String> {
    Run::get_stats(&filters).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_split_stats(filters: RunFilters) -> Result<Vec<SplitStat>, String> {
    Split::get_stats(&filters).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_reference_run(data: ReferenceRunData) -> Result<i64, String> {
    // Insert the reference run
    let run_id = Run::insert_reference(&data).map_err(|e| e.to_string())?;

    // Insert all splits for the reference run
    let mut prev_time = 0i64;
    for split_data in &data.splits {
        let segment_time = split_data.split_time_ms - prev_time;
        let new_split = NewSplit {
            run_id,
            breakpoint_type: split_data.breakpoint_type.clone(),
            breakpoint_name: split_data.breakpoint_name.clone(),
            split_time_ms: split_data.split_time_ms,
            delta_ms: None,
            segment_time_ms: segment_time,
            town_time_ms: 0,
            hideout_time_ms: 0,
        };
        Split::insert(&new_split).map_err(|e| e.to_string())?;
        prev_time = split_data.split_time_ms;
    }

    Ok(run_id)
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

/// Map ascendancy class ID to ascendancy name
fn get_ascendancy_name(class: &str, ascendancy_class: u32) -> Option<String> {
    // ascendancy_class 0 means no ascendancy
    if ascendancy_class == 0 {
        return None;
    }

    // Mapping based on PoE class/ascendancy structure
    // Each class has 3 ascendancies (1, 2, 3)
    let ascendancies: &[&str] = match class {
        "Scion" => &["Ascendant"],
        "Marauder" => &["Juggernaut", "Berserker", "Chieftain"],
        "Ranger" => &["Warden", "Deadeye", "Pathfinder"], // Warden replaced Raider
        "Witch" => &["Necromancer", "Elementalist", "Occultist"],
        "Duelist" => &["Slayer", "Gladiator", "Champion"],
        "Templar" => &["Inquisitor", "Hierophant", "Guardian"],
        "Shadow" => &["Assassin", "Saboteur", "Trickster"],
        _ => return None,
    };

    let index = (ascendancy_class as usize).saturating_sub(1);
    ascendancies.get(index).map(|s| s.to_string())
}

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
    let (items_json, character_level, char_class, ascendancy_class, league) = match items_result {
        Ok(data) => {
            let items_json = serde_json::to_string(&data.items).unwrap_or_else(|_| "[]".to_string());
            (
                items_json,
                data.character.level as i32,
                data.character.class.clone(),
                data.character.ascendancy_class,
                data.character.league.clone(),
            )
        }
        Err(e) => {
            let _ = app_handle.emit("snapshot-failed", serde_json::json!({
                "split_id": split_id,
                "error": e.to_string(),
            }));
            return;
        }
    };

    // Update run's class/ascendancy if we got valid data from API
    if !char_class.is_empty() && char_class != "Unknown" {
        let ascendancy_name = get_ascendancy_name(&char_class, ascendancy_class);
        let league_opt = if league.is_empty() { None } else { Some(league.as_str()) };
        let _ = Run::update_class_info(run_id, &char_class, ascendancy_name.as_deref(), league_opt);
    }

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
        .header("User-Agent", "POE-Watcher/0.2.0 (https://github.com/kburke8/poe-watcher; Discord: beerdz)")
        .body(pob_code)
        .send()
        .await
        .map_err(|e| format!("Failed to upload: {}", e))?;

    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;
    let text = text.trim();

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

// ============================================================================
// Image Proxy Commands (for CORS bypass)
// ============================================================================

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[tauri::command]
pub async fn proxy_image(url: String) -> Result<String, String> {
    // Only allow proxying from trusted domains - parse URL to prevent bypass
    let parsed = reqwest::Url::parse(&url).map_err(|_| "Invalid URL".to_string())?;
    if parsed.host_str() != Some("web.poecdn.com") {
        return Err("Only web.poecdn.com URLs are allowed".to_string());
    }

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "POE-Watcher/0.2.0 (https://github.com/kburke8/poe-watcher; Discord: beerdz)")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch image: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Image fetch failed with status: {}", response.status()));
    }

    // Get content type
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();

    // Get bytes and convert to base64
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;

    let base64_data = BASE64.encode(&bytes);

    // Return as data URL
    Ok(format!("data:{};base64,{}", content_type, base64_data))
}

// ============================================================================
// JSON Export Commands
// ============================================================================

#[tauri::command]
pub async fn export_run_json(run_id: i64, file_path: String) -> Result<(), String> {
    let run = Run::get_by_id(run_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Run {} not found", run_id))?;

    let splits = Split::get_by_run(run_id).map_err(|e| e.to_string())?;
    let snapshots = Snapshot::get_by_run(run_id).map_err(|e| e.to_string())?;

    // Build splits array
    let splits_json: Vec<serde_json::Value> = splits
        .iter()
        .map(|s| {
            serde_json::json!({
                "breakpointName": s.breakpoint_name,
                "breakpointType": s.breakpoint_type,
                "splitTimeMs": s.split_time_ms,
                "segmentTimeMs": s.segment_time_ms,
                "deltaMs": s.delta_ms,
                "townTimeMs": s.town_time_ms,
                "hideoutTimeMs": s.hideout_time_ms,
            })
        })
        .collect();

    // Build snapshots array - parse JSON string fields into proper values
    let snapshots_json: Vec<serde_json::Value> = snapshots
        .iter()
        .map(|snap| {
            // Find the split name for this snapshot
            let split_name = splits
                .iter()
                .find(|s| s.id == snap.split_id)
                .map(|s| s.breakpoint_name.as_str())
                .unwrap_or("Unknown");

            let items: serde_json::Value = serde_json::from_str(&snap.items_json)
                .unwrap_or(serde_json::Value::Array(vec![]));
            let passive_tree: serde_json::Value = serde_json::from_str(&snap.passive_tree_json)
                .unwrap_or(serde_json::json!({}));

            serde_json::json!({
                "splitName": split_name,
                "elapsedTimeMs": snap.elapsed_time_ms,
                "characterLevel": snap.character_level,
                "items": items,
                "passiveTree": passive_tree,
                "pobCode": snap.pob_code,
            })
        })
        .collect();

    let export = serde_json::json!({
        "version": "0.2.0",
        "exportedAt": chrono::Utc::now().to_rfc3339(),
        "run": {
            "character": run.character_name,
            "class": run.class,
            "ascendancy": run.ascendancy,
            "league": run.league,
            "category": run.category,
            "startedAt": run.started_at,
            "endedAt": run.ended_at,
            "totalTimeMs": run.total_time_ms,
            "isCompleted": run.is_completed,
            "isPersonalBest": run.is_personal_best,
            "breakpointPreset": run.breakpoint_preset,
        },
        "splits": splits_json,
        "snapshots": snapshots_json,
    });

    let json_str = serde_json::to_string_pretty(&export)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;

    std::fs::write(&file_path, json_str)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

// ============================================================================
// Overlay Commands
// ============================================================================

#[tauri::command]
pub async fn open_overlay(app_handle: AppHandle) -> Result<(), String> {
    // Check if overlay already exists
    if app_handle.get_webview_window("overlay").is_some() {
        if let Some(window) = app_handle.get_webview_window("overlay") {
            window.set_focus().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    // Load saved position
    let (saved_x, saved_y) = Settings::get_overlay_position().unwrap_or((None, None));

    // Build the overlay window
    let mut builder = WebviewWindowBuilder::new(
        &app_handle,
        "overlay",
        WebviewUrl::App("overlay.html".into()),
    )
    .title("POE Watcher Overlay")
    .inner_size(320.0, 180.0)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false);

    // Set position if saved
    if let (Some(x), Some(y)) = (saved_x, saved_y) {
        builder = builder.position(x as f64, y as f64);
    }

    builder.build().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_overlay(app_handle: AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("overlay") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn toggle_overlay(app_handle: AppHandle) -> Result<bool, String> {
    if let Some(window) = app_handle.get_webview_window("overlay") {
        // Window exists - close it
        window.close().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        // Window doesn't exist - open it
        open_overlay(app_handle).await?;
        Ok(true)
    }
}

#[tauri::command]
pub async fn set_overlay_position(x: i32, y: i32) -> Result<(), String> {
    Settings::save_overlay_position(x, y).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_overlay_position() -> Result<(Option<i32>, Option<i32>), String> {
    Settings::get_overlay_position().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_overlay_state(app_handle: AppHandle, state: serde_json::Value) -> Result<(), String> {
    if let Some(overlay) = app_handle.get_webview_window("overlay") {
        overlay.emit("overlay-state-update", state).map_err(|e| e.to_string())?;
    }
    Ok(())
}
