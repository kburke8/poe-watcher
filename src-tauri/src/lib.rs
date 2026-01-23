mod api_client;
mod commands;
mod db;
mod log_watcher;

use commands::*;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            db::init_db(app_data_dir).expect("Failed to initialize database");

            // Load settings and start log watcher if configured
            if let Ok(settings) = db::Settings::load() {
                if !settings.poe_log_path.is_empty() {
                    let path = std::path::PathBuf::from(&settings.poe_log_path);
                    if path.exists() {
                        let mut watcher = log_watcher::LogWatcher::new(path);
                        if let Err(e) = watcher.start(app.handle().clone()) {
                            eprintln!("Failed to start log watcher: {}", e);
                        }
                    }
                }
            }

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
            // Runs
            create_run,
            complete_run,
            get_runs,
            get_run,
            // Splits
            add_split,
            get_splits,
            manual_split,
            // Snapshots
            create_snapshot,
            get_snapshots,
            // Personal bests
            get_personal_bests,
            // Gold splits
            get_gold_splits,
            // API
            fetch_characters,
            fetch_character_data,
            fetch_passive_tree,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
