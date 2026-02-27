mod api_client;
mod commands;
mod db;
mod log_watcher;

use commands::*;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Shared state mapping shortcut strings to action names.
/// Accessible from commands via `app.state::<HotkeyMap>()`.
pub struct HotkeyMap(pub Arc<std::sync::Mutex<HashMap<String, String>>>);

/// In-memory flag for minimize-to-tray behavior.
/// Read synchronously in `on_window_event`, updated by `set_minimize_to_tray` command.
pub struct MinimizeToTrayFlag(pub Arc<std::sync::Mutex<bool>>);

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

            // Register hotkeys from settings (or defaults)
            let hotkeys_to_register = vec![
                (settings.hotkey_toggle_timer.clone(), "toggle-timer"),
                (settings.hotkey_reset_timer.clone(), "reset-timer"),
                (settings.hotkey_manual_snapshot.clone(), "manual-snapshot"),
                (settings.hotkey_toggle_overlay.clone(), "toggle-overlay"),
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
