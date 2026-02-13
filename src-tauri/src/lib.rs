mod api_client;
mod commands;
mod db;
mod log_watcher;

use commands::*;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Shared state mapping shortcut strings to action names.
/// Accessible from commands via `app.state::<HotkeyMap>()`.
pub struct HotkeyMap(pub Arc<std::sync::Mutex<HashMap<String, String>>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Shared map: shortcut string -> action name
    let hotkey_map: Arc<std::sync::Mutex<HashMap<String, String>>> =
        Arc::new(std::sync::Mutex::new(HashMap::new()));
    let map_for_handler = hotkey_map.clone();

    // Store the app handle for the global shortcut handler
    let app_handle: Arc<std::sync::Mutex<Option<tauri::AppHandle>>> =
        Arc::new(std::sync::Mutex::new(None));
    let app_handle_for_handler = app_handle.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |_app, shortcut_ref, event| {
                    if event.state() == ShortcutState::Pressed {
                        if let Some(handle) = app_handle_for_handler.lock().ok().and_then(|guard| guard.clone()) {
                            let shortcut_str = shortcut_ref.to_string();
                            // Look up the action for this shortcut in the shared map
                            if let Ok(map) = map_for_handler.lock() {
                                if let Some(action) = map.get(&shortcut_str) {
                                    let _ = handle.emit("global-shortcut", action.as_str());
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(move |app| {
            // Store the app handle for the global shortcut handler
            if let Ok(mut guard) = app_handle.lock() {
                *guard = Some(app.handle().clone());
            }

            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            db::init_db(app_data_dir).expect("Failed to initialize database");

            // Load settings (including hotkeys) and register shortcuts
            let settings = db::Settings::load().unwrap_or_default();

            // Start log watcher if configured
            if !settings.poe_log_path.is_empty() {
                let path = std::path::PathBuf::from(&settings.poe_log_path);
                if path.exists() {
                    let handle = app.handle().clone();
                    let log_path = settings.poe_log_path.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = commands::start_log_watcher(handle, log_path).await;
                    });
                }
            }

            // Register hotkeys from settings (or defaults)
            let hotkeys_to_register = vec![
                (settings.hotkey_toggle_timer.clone(), "toggle-timer"),
                (settings.hotkey_reset_timer.clone(), "reset-timer"),
                (settings.hotkey_manual_snapshot.clone(), "manual-snapshot"),
                (settings.hotkey_toggle_overlay.clone(), "toggle-overlay"),
                (settings.hotkey_toggle_overlay_lock.clone(), "toggle-overlay-lock"),
                (settings.hotkey_manual_split.clone(), "manual-split"),
            ];

            {
                let mut map = hotkey_map.lock().expect("Failed to lock hotkey map");

                // Unregister any leftover shortcuts from a previous instance
                // (force-killing the app on Windows can leave registrations dangling)
                let _ = app.global_shortcut().unregister_all();

                for (shortcut_str, action) in &hotkeys_to_register {
                    if let Ok(shortcut) = shortcut_str.parse::<Shortcut>() {
                        match app.global_shortcut().register(shortcut.clone()) {
                            Ok(_) => {
                                eprintln!("[hotkeys] Registered global shortcut: {} -> {}", shortcut.to_string(), action);
                            }
                            Err(e) => {
                                eprintln!("[hotkeys] Failed to register global shortcut {}: {}", shortcut_str, e);
                            }
                        }
                        // Use canonical Shortcut::to_string() as key so it matches
                        // the handler's shortcut_ref.to_string() lookup format.
                        map.insert(shortcut.to_string(), action.to_string());
                    }
                }
            }

            // Store the hotkey map as managed state so commands can access it
            app.manage(HotkeyMap(hotkey_map));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            get_settings,
            save_settings,
            detect_log_path_cmd,
            browse_log_path,
            // Log watcher
            start_log_watcher,
            stop_log_watcher,
            set_log_poll_fast,
            // Runs
            create_run,
            update_run_character,
            complete_run,
            get_runs,
            get_run,
            delete_run,
            get_runs_filtered,
            get_run_stats,
            get_split_stats,
            create_reference_run,
            // Splits
            add_split,
            get_splits,
            manual_split,
            // Snapshots
            create_snapshot,
            get_snapshots,
            get_snapshot,
            capture_snapshot,
            // Personal bests
            get_personal_bests,
            // Gold splits
            get_gold_splits,
            // API
            fetch_characters,
            fetch_character_data,
            fetch_passive_tree,
            // PoB Export
            upload_to_pobbin,
            // JSON Export
            export_run_json,
            // Image Proxy (CORS bypass)
            proxy_image,
            // Hotkeys
            get_hotkeys,
            update_hotkeys,
            // Overlay
            open_overlay,
            close_overlay,
            toggle_overlay,
            set_overlay_position,
            get_overlay_position,
            sync_overlay_state,
            overlay_ready,
            resize_overlay,
            set_overlay_always_on_top,
            reset_overlay_position,
        ])
        .on_window_event(|window, event| {
            // When the main window is closed, close the overlay and exit
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    // Close the overlay window if it exists
                    if let Some(overlay) = window.app_handle().get_webview_window("overlay") {
                        let _ = overlay.close();
                    }
                    // Exit the process so it doesn't linger
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
