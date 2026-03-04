use crate::api_client::PoeApiClient;
use crate::db::{
    NewRun, NewSplit, NewSnapshot, PersonalBest, Run, Settings, Snapshot, Split, GoldSplit,
    RunFilters, RunStats, SplitStat, ReferenceRunData,
    GroupMember, NewGroupMember, GroupSnapshot, NewGroupSnapshot,
};
use crate::log_watcher::{detect_log_path, LogWatcher};
use crate::keyboard_hook::{parse_shortcut, KeyboardHookManager};
use crate::MinimizeToTrayFlag;
use anyhow::Result;
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, LogicalSize};

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
pub async fn abandon_run(run_id: i64, total_time_ms: i64) -> Result<(), String> {
    Run::abandon(run_id, total_time_ms).map_err(|e| e.to_string())
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
    // town_time_ms from the frontend is per-segment, but real runs store it
    // cumulatively. Accumulate here so comparisons work correctly.
    let mut prev_time = 0i64;
    let mut cumulative_town_ms = 0i64;
    for split_data in &data.splits {
        let segment_time = split_data.split_time_ms - prev_time;
        cumulative_town_ms += split_data.town_time_ms;
        let new_split = NewSplit {
            run_id,
            breakpoint_type: split_data.breakpoint_type.clone(),
            breakpoint_name: split_data.breakpoint_name.clone(),
            split_time_ms: split_data.split_time_ms,
            delta_ms: None,
            segment_time_ms: segment_time,
            town_time_ms: cumulative_town_ms,
            hideout_time_ms: 0,
            death_count: 0,
            boss_fight_ms: split_data.boss_fight_ms,
        };
        Split::insert(&new_split).map_err(|e| e.to_string())?;
        prev_time = split_data.split_time_ms;
    }

    Ok(run_id)
}

#[tauri::command]
pub async fn update_reference_run(run_id: i64, data: ReferenceRunData) -> Result<(), String> {
    Run::update_reference(run_id, &data).map_err(|e| e.to_string())?;
    Split::replace_for_run(run_id, &data.splits).map_err(|e| e.to_string())?;
    Ok(())
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
        let _ = GoldSplit::update_if_better(&category, &run.class, &split.breakpoint_name, split.segment_time_ms);
    }

    // Capture snapshot if requested
    if request.capture_snapshot {
        if let (Some(account_name), Some(character_name), Some(ref run)) =
            (request.account_name, request.character_name, run.as_ref())
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

    // Capture group snapshots if this is a group run with group mode enabled
    if request.capture_snapshot {
        if let Some(ref run) = run {
            if run.is_group_run {
                if let Ok(settings) = Settings::load() {
                    if settings.group_mode_enabled {
                        let handle = app_handle.clone();
                        let run_id = run.id;
                        let elapsed_time_ms = split.split_time_ms;
                        tokio::spawn(async move {
                            capture_group_snapshots_for_split(
                                handle,
                                run_id,
                                split_id,
                                elapsed_time_ms,
                            ).await;
                        });
                    }
                }
            }
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
        .header("User-Agent", "PoE-Watcher/0.2.0 (https://github.com/kburke8/poe-watcher; Discord: beerdz)")
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
        .header("User-Agent", "PoE-Watcher/0.2.0 (https://github.com/kburke8/poe-watcher; Discord: beerdz)")
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
                "bossFightMs": s.boss_fight_ms,
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
// Hotkey Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeySettings {
    pub toggle_timer: String,
    pub reset_timer: String,
    pub manual_snapshot: String,
    pub toggle_overlay: String,
    pub manual_split: String,
}

#[tauri::command]
pub async fn get_hotkeys() -> Result<HotkeySettings, String> {
    let settings = Settings::load().map_err(|e| e.to_string())?;
    Ok(HotkeySettings {
        toggle_timer: settings.hotkey_toggle_timer,
        reset_timer: settings.hotkey_reset_timer,
        manual_snapshot: settings.hotkey_manual_snapshot,
        toggle_overlay: settings.hotkey_toggle_overlay,
        manual_split: settings.hotkey_manual_split,
    })
}

#[tauri::command]
pub async fn update_hotkeys(app_handle: AppHandle, hotkeys: HotkeySettings) -> Result<(), String> {
    // Define the action mappings
    let new_bindings_raw = vec![
        (hotkeys.toggle_timer.as_str(), "toggle-timer"),
        (hotkeys.reset_timer.as_str(), "reset-timer"),
        (hotkeys.manual_snapshot.as_str(), "manual-snapshot"),
        (hotkeys.toggle_overlay.as_str(), "toggle-overlay"),
        (hotkeys.manual_split.as_str(), "manual-split"),
    ];

    // Validate: parse all new shortcuts first
    let mut parsed = Vec::new();
    for (shortcut_str, action) in &new_bindings_raw {
        let binding = parse_shortcut(shortcut_str, action)
            .ok_or_else(|| format!("Invalid shortcut format: {}", shortcut_str))?;
        parsed.push((shortcut_str.to_string(), binding));
    }

    // Validate: check for duplicates (same vk_code + modifiers)
    for i in 0..parsed.len() {
        for j in (i + 1)..parsed.len() {
            let a = &parsed[i].1;
            let b = &parsed[j].1;
            if a.vk_code == b.vk_code && a.ctrl == b.ctrl && a.shift == b.shift && a.alt == b.alt {
                return Err(format!("Duplicate shortcut: {} and {}", parsed[i].0, parsed[j].0));
            }
        }
    }

    // Update the keyboard hook bindings
    let manager = app_handle.state::<KeyboardHookManager>();
    let bindings: Vec<_> = parsed.into_iter().map(|(_, b)| b).collect();
    manager.update_bindings(bindings);

    // Persist to database
    let mut settings = Settings::load().map_err(|e| e.to_string())?;
    settings.hotkey_toggle_timer = hotkeys.toggle_timer;
    settings.hotkey_reset_timer = hotkeys.reset_timer;
    settings.hotkey_manual_snapshot = hotkeys.manual_snapshot;
    settings.hotkey_toggle_overlay = hotkeys.toggle_overlay;
    settings.hotkey_manual_split = hotkeys.manual_split;
    Settings::save(&settings).map_err(|e| e.to_string())?;

    Ok(())
}

/// Temporarily disable hotkey detection so the webview can capture key combos
/// in the HotkeyInput component. The bindings are preserved so `resume_hotkeys`
/// re-enables the exact same hotkeys.
#[tauri::command]
pub async fn suspend_hotkeys(app_handle: AppHandle) -> Result<(), String> {
    let manager = app_handle.state::<KeyboardHookManager>();
    manager.suspend();
    Ok(())
}

/// Re-enable hotkey detection after hotkey capture is finished.
#[tauri::command]
pub async fn resume_hotkeys(app_handle: AppHandle) -> Result<(), String> {
    let manager = app_handle.state::<KeyboardHookManager>();
    manager.resume();
    Ok(())
}

// ============================================================================
// System Tray Commands
// ============================================================================

#[tauri::command]
pub async fn set_minimize_to_tray(app_handle: AppHandle, enabled: bool) -> Result<(), String> {
    let flag = app_handle.state::<MinimizeToTrayFlag>();
    let mut guard = flag.0.lock().map_err(|e| e.to_string())?;
    *guard = enabled;
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

    // Load saved position and settings
    let (saved_x, saved_y) = Settings::get_overlay_position().unwrap_or((None, None));
    let settings = Settings::load().unwrap_or_default();

    // Determine size from scale setting (must match OverlayApp.tsx sizes)
    let (width, height) = match settings.overlay_scale.as_str() {
        "small" => (240.0, 120.0),
        "large" => (420.0, 240.0),
        _ => (320.0, 180.0), // medium (default)
    };

    // Build the overlay window.
    // When transparent mode is on: transparent(true) + --disable-gpu for CSS rgba backgrounds.
    // When opaque (default): solid window, no --disable-gpu. OBS "auto" capture works out of the box.
    let is_transparent = settings.overlay_stream_mode;

    let mut builder = WebviewWindowBuilder::new(
        &app_handle,
        "overlay",
        WebviewUrl::App("overlay.html".into()),
    )
    .title("PoE Watcher Overlay")
    .inner_size(width, height)
    .decorations(false)
    .always_on_top(settings.overlay_always_on_top)
    .skip_taskbar(true)
    .resizable(false);

    if is_transparent {
        builder = builder.transparent(true);
    }

    // A separate data_directory is required when browser args differ between windows
    // (WebView2 constraint, see tauri-apps/tauri#11144).
    #[cfg(target_os = "windows")]
    {
        let app_data = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
        let overlay_data_dir = app_data.join("overlay-webview");
        if is_transparent {
            builder = builder.additional_browser_args("--disable-gpu");
        }
        builder = builder.data_directory(overlay_data_dir);
    }

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
    // Notify main window that overlay was closed
    let _ = app_handle.emit("overlay-closed", ());
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
    if app_handle.get_webview_window("overlay").is_some() {
        app_handle.emit_to("overlay", "overlay-state-update", state).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn overlay_ready(app_handle: AppHandle) -> Result<(), String> {
    app_handle.emit_to("main", "overlay-ready", ()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn resize_overlay(app_handle: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(overlay) = app_handle.get_webview_window("overlay") {
        overlay.set_size(LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn set_overlay_always_on_top(app_handle: AppHandle, enabled: bool) -> Result<(), String> {
    if let Some(overlay) = app_handle.get_webview_window("overlay") {
        overlay.set_always_on_top(enabled).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn reset_overlay_position(app_handle: AppHandle) -> Result<(), String> {
    if let Some(overlay) = app_handle.get_webview_window("overlay") {
        overlay.set_position(tauri::LogicalPosition::new(100.0, 100.0)).map_err(|e| e.to_string())?;
    }
    Settings::save_overlay_position(100, 100).map_err(|e| e.to_string())?;
    Ok(())
}

// ============================================================================
// Group Mode Commands
// ============================================================================

#[tauri::command]
pub async fn get_group_members() -> Result<Vec<GroupMember>, String> {
    GroupMember::get_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_group_member(member: NewGroupMember) -> Result<i64, String> {
    GroupMember::insert(&member).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_group_member(
    id: i64,
    character_name: Option<String>,
    display_name: Option<String>,
) -> Result<(), String> {
    GroupMember::update(id, character_name.as_deref(), display_name.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_group_member(id: i64) -> Result<(), String> {
    GroupMember::delete(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_group_member_active(id: i64, is_active: bool) -> Result<(), String> {
    GroupMember::set_active(id, is_active).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_group_character_names() -> Result<(), String> {
    GroupMember::clear_character_names().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_group_snapshots(run_id: i64) -> Result<Vec<GroupSnapshot>, String> {
    GroupSnapshot::get_by_run(run_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_group_snapshots_for_split(split_id: i64) -> Result<Vec<GroupSnapshot>, String> {
    GroupSnapshot::get_by_split(split_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_group_snapshot(snapshot_id: i64) -> Result<Option<GroupSnapshot>, String> {
    GroupSnapshot::get_by_id(snapshot_id).map_err(|e| e.to_string())
}

/// Resolve characters for a group member's account
#[tauri::command]
pub async fn resolve_group_member_characters(
    account_name: String,
) -> Result<Vec<crate::api_client::PoeCharacter>, String> {
    let client = get_api_client();
    client
        .get_characters(&account_name)
        .await
        .map_err(|e| e.to_string())
}

/// Detect group member characters for a league by polling the API
#[tauri::command]
pub async fn detect_group_characters(
    app_handle: AppHandle,
    league: String,
) -> Result<(), String> {
    let client = get_api_client();
    let members = GroupMember::get_active().map_err(|e| e.to_string())?;

    for member in &members {
        // Skip members that already have a character name
        if member.character_name.is_some() {
            continue;
        }

        let _ = app_handle.emit("group-member-detection-started", serde_json::json!({
            "memberId": member.id,
            "accountName": member.account_name,
        }));

        match client.get_characters_uncached(&member.account_name).await {
            Ok(characters) => {
                // Filter to current league
                let league_chars: Vec<_> = characters
                    .iter()
                    .filter(|c| {
                        if league.is_empty() {
                            true
                        } else {
                            c.league.eq_ignore_ascii_case(&league)
                        }
                    })
                    .collect();

                // Heuristic: find the active speedrun character
                let detected = if league_chars.len() == 1 {
                    // Only one character in the league - that's it
                    Some(league_chars[0])
                } else if !league_chars.is_empty() {
                    // Multiple characters - pick lowest level (most recently created)
                    let mut low_level: Vec<_> = league_chars
                        .iter()
                        .filter(|c| c.level <= 4)
                        .collect();

                    if low_level.len() == 1 {
                        Some(*low_level[0])
                    } else if low_level.is_empty() {
                        // No low-level characters, pick the lowest level overall
                        league_chars.iter().min_by_key(|c| c.level).copied()
                    } else {
                        // Multiple low-level characters, pick the lowest
                        low_level.sort_by_key(|c| c.level);
                        Some(*low_level[0])
                    }
                } else {
                    None
                };

                if let Some(character) = detected {
                    let _ = GroupMember::update_character_name(member.id, &character.name);
                    let _ = app_handle.emit("group-member-character-detected", serde_json::json!({
                        "memberId": member.id,
                        "accountName": member.account_name,
                        "characterName": character.name,
                        "characterClass": character.class,
                        "characterLevel": character.level,
                        "characterLeague": character.league,
                        "characterExperience": character.experience,
                    }));
                } else {
                    let _ = app_handle.emit("group-member-detection-failed", serde_json::json!({
                        "memberId": member.id,
                        "accountName": member.account_name,
                        "reason": "No matching character found in league",
                    }));
                }
            }
            Err(e) => {
                let _ = app_handle.emit("group-member-detection-failed", serde_json::json!({
                    "memberId": member.id,
                    "accountName": member.account_name,
                    "reason": e.to_string(),
                }));
            }
        }
    }

    Ok(())
}

/// Poll active group members' character info (level, class) from the API
#[tauri::command]
pub async fn poll_group_member_info() -> Result<Vec<serde_json::Value>, String> {
    let client = get_api_client();
    let members = GroupMember::get_active().map_err(|e| e.to_string())?;
    let mut results = Vec::new();

    for member in &members {
        let char_name = match &member.character_name {
            Some(name) => name.clone(),
            None => continue,
        };

        match client.get_characters(&member.account_name).await {
            Ok(characters) => {
                if let Some(ch) = characters.iter().find(|c| c.name == char_name) {
                    results.push(serde_json::json!({
                        "memberId": member.id,
                        "characterClass": ch.class,
                        "characterLevel": ch.level,
                        "characterLeague": ch.league,
                    }));
                }
            }
            Err(_) => {} // Silently skip failed fetches during polling
        }
    }

    Ok(results)
}

/// Async function to capture group snapshots for a split
async fn capture_group_snapshots_for_split(
    app_handle: AppHandle,
    run_id: i64,
    split_id: i64,
    elapsed_time_ms: i64,
) {
    let members = match GroupMember::get_active() {
        Ok(m) => m,
        Err(_) => return,
    };

    let total = members.len();
    let client = get_api_client();

    for (index, member) in members.iter().enumerate() {
        let character_name = match &member.character_name {
            Some(name) if !name.is_empty() => name.clone(),
            _ => {
                let _ = app_handle.emit("group-snapshot-member-skipped", serde_json::json!({
                    "splitId": split_id,
                    "memberId": member.id,
                    "accountName": member.account_name,
                    "reason": "No character name resolved",
                }));
                continue;
            }
        };

        let _ = app_handle.emit("group-snapshot-progress", serde_json::json!({
            "splitId": split_id,
            "memberIndex": index,
            "total": total,
            "accountName": member.account_name,
            "characterName": character_name,
        }));

        // Fetch items
        let items_result = client.get_items(&member.account_name, &character_name).await;
        let (items_json, character_level) = match items_result {
            Ok(data) => {
                let items_json = serde_json::to_string(&data.items).unwrap_or_else(|_| "[]".to_string());
                (items_json, data.character.level as i32)
            }
            Err(e) => {
                let _ = app_handle.emit("group-snapshot-member-failed", serde_json::json!({
                    "splitId": split_id,
                    "memberId": member.id,
                    "accountName": member.account_name,
                    "error": e.to_string(),
                }));
                continue;
            }
        };

        // Fetch passive skills
        let passives_result = client.get_passive_skills(&member.account_name, &character_name).await;
        let passive_tree_json = match passives_result {
            Ok(data) => serde_json::to_string(&data).unwrap_or_else(|_| "{}".to_string()),
            Err(e) => {
                let _ = app_handle.emit("group-snapshot-member-failed", serde_json::json!({
                    "splitId": split_id,
                    "memberId": member.id,
                    "accountName": member.account_name,
                    "error": e.to_string(),
                }));
                continue;
            }
        };

        // Create group snapshot
        let snapshot = NewGroupSnapshot {
            run_id,
            split_id,
            group_member_id: member.id,
            timestamp: chrono::Utc::now().to_rfc3339(),
            elapsed_time_ms,
            character_level,
            character_name: character_name.clone(),
            account_name: member.account_name.clone(),
            items_json,
            skills_json: "[]".to_string(),
            passive_tree_json,
            stats_json: "{}".to_string(),
            pob_code: None,
        };

        match GroupSnapshot::insert(&snapshot) {
            Ok(snapshot_id) => {
                let _ = app_handle.emit("group-snapshot-member-complete", serde_json::json!({
                    "splitId": split_id,
                    "memberId": member.id,
                    "snapshotId": snapshot_id,
                    "accountName": member.account_name,
                    "characterLevel": character_level,
                }));
            }
            Err(e) => {
                let _ = app_handle.emit("group-snapshot-member-failed", serde_json::json!({
                    "splitId": split_id,
                    "memberId": member.id,
                    "accountName": member.account_name,
                    "error": e.to_string(),
                }));
            }
        }
    }

    let _ = app_handle.emit("group-snapshot-complete", serde_json::json!({
        "splitId": split_id,
        "runId": run_id,
    }));
}
