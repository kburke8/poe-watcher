mod api_client;
mod commands;
mod db;
mod keyboard_hook;
mod log_watcher;

use commands::*;
use keyboard_hook::{parse_shortcut, KeyboardHookManager};
use std::sync::Arc;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;

/// In-memory flag for minimize-to-tray behavior.
/// Read synchronously in `on_window_event`, updated by `set_minimize_to_tray` command.
pub struct MinimizeToTrayFlag(pub Arc<std::sync::Mutex<bool>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(move |app| {

            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            db::init_db(app_data_dir).expect("Failed to initialize database");

            // Load settings (including hotkeys) and register shortcuts
            let settings = db::Settings::load().unwrap_or_default();

            // Set up minimize-to-tray flag from persisted setting
            let minimize_flag = Arc::new(std::sync::Mutex::new(settings.minimize_to_tray));
            app.manage(MinimizeToTrayFlag(minimize_flag));

            // Create system tray icon with context menu
            let show_item = MenuItemBuilder::with_id("show", "Show PoE Watcher").build(app)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&separator)
                .item(&quit_item)
                .build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .tooltip("PoE Watcher")
                .on_menu_event(|app_handle, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            // Close overlay if open
                            if let Some(overlay) = app_handle.get_webview_window("overlay") {
                                let _ = overlay.close();
                            }
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                        let app_handle = tray.app_handle();
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

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

            // Register hotkeys from settings (or defaults) via low-level keyboard hook
            let hotkeys_to_register = vec![
                (settings.hotkey_toggle_timer.as_str(), "toggle-timer"),
                (settings.hotkey_reset_timer.as_str(), "reset-timer"),
                (settings.hotkey_manual_snapshot.as_str(), "manual-snapshot"),
                (settings.hotkey_toggle_overlay.as_str(), "toggle-overlay"),
                (settings.hotkey_manual_split.as_str(), "manual-split"),
            ];

            let bindings: Vec<_> = hotkeys_to_register
                .iter()
                .filter_map(|(shortcut_str, action)| {
                    match parse_shortcut(shortcut_str, action) {
                        Some(b) => {
                            eprintln!("[hotkeys] Parsed hotkey: {} -> {}", shortcut_str, action);
                            Some(b)
                        }
                        None => {
                            eprintln!("[hotkeys] Failed to parse hotkey: {}", shortcut_str);
                            None
                        }
                    }
                })
                .collect();

            let manager = KeyboardHookManager::start(app.handle().clone(), bindings);
            app.manage(manager);

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
            update_run_video,
            complete_run,
            abandon_run,
            get_runs,
            get_run,
            delete_run,
            get_runs_filtered,
            get_run_stats,
            get_split_stats,
            create_reference_run,
            update_reference_run,
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
            suspend_hotkeys,
            resume_hotkeys,
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
            // Group mode
            get_group_members,
            add_group_member,
            update_group_member,
            remove_group_member,
            set_group_member_active,
            clear_group_character_names,
            get_group_snapshots,
            get_group_snapshots_for_split,
            get_group_snapshot,
            resolve_group_member_characters,
            detect_group_characters,
            poll_group_member_info,
            // System tray
            set_minimize_to_tray,
        ])
        .on_window_event(|window, event| {
            // When the main window is closed, either hide to tray or exit
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    // Check minimize-to-tray flag
                    let should_minimize = window
                        .app_handle()
                        .try_state::<MinimizeToTrayFlag>()
                        .and_then(|flag| flag.0.lock().ok().map(|guard| *guard))
                        .unwrap_or(false);

                    if should_minimize {
                        // Prevent the window from closing and hide it instead
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        // Close the overlay window if it exists
                        if let Some(overlay) = window.app_handle().get_webview_window("overlay") {
                            let _ = overlay.close();
                        }
                        // Exit the process so it doesn't linger
                        window.app_handle().exit(0);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
