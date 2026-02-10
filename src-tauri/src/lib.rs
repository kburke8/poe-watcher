mod api_client;
mod commands;
mod db;
mod log_watcher;

use commands::*;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
                            // Determine which shortcut was pressed
                            let shortcut_str = shortcut_ref.to_string();
                            if shortcut_str.contains("Shift") && shortcut_str.contains("Space") {
                                let _ = handle.emit("global-shortcut", "reset-timer");
                            } else if shortcut_str.contains("Alt") && shortcut_str.contains("Space") {
                                let _ = handle.emit("global-shortcut", "manual-snapshot");
                            } else if shortcut_str.contains("Space") {
                                let _ = handle.emit("global-shortcut", "toggle-timer");
                            } else if shortcut_str.contains("Shift") && shortcut_str.to_lowercase().contains("o") {
                                // Ctrl+Shift+O - toggle overlay lock
                                let _ = handle.emit("global-shortcut", "toggle-overlay-lock");
                            } else if shortcut_str.to_lowercase().contains("o") {
                                // Ctrl+O - toggle overlay window
                                let _ = handle.emit("global-shortcut", "toggle-overlay");
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

            // Load settings and start log watcher if configured
            // Note: We use the start_log_watcher command instead of creating directly
            // to ensure the global state is properly managed
            if let Ok(settings) = db::Settings::load() {
                if !settings.poe_log_path.is_empty() {
                    let path = std::path::PathBuf::from(&settings.poe_log_path);
                    if path.exists() {
                        let handle = app.handle().clone();
                        let log_path = settings.poe_log_path.clone();
                        // Spawn async task to start watcher via command
                        tauri::async_runtime::spawn(async move {
                            let _ = commands::start_log_watcher(handle, log_path).await;
                        });
                    }
                }
            }

            // Register global hotkeys (ignore errors if already registered from previous instance)
            let shortcut: Shortcut = "Ctrl+Space".parse().expect("Invalid shortcut");
            let _ = app.global_shortcut().register(shortcut);

            let reset_shortcut: Shortcut = "Ctrl+Shift+Space".parse().expect("Invalid shortcut");
            let _ = app.global_shortcut().register(reset_shortcut);

            let snapshot_shortcut: Shortcut = "Ctrl+Alt+Space".parse().expect("Invalid shortcut");
            let _ = app.global_shortcut().register(snapshot_shortcut);

            let overlay_shortcut: Shortcut = "Ctrl+O".parse().expect("Invalid shortcut");
            let _ = app.global_shortcut().register(overlay_shortcut);

            let lock_shortcut: Shortcut = "Ctrl+Shift+O".parse().expect("Invalid shortcut");
            let _ = app.global_shortcut().register(lock_shortcut);

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
            // Image Proxy (CORS bypass)
            proxy_image,
            // Overlay
            open_overlay,
            close_overlay,
            toggle_overlay,
            set_overlay_position,
            get_overlay_position,
            sync_overlay_state,
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
