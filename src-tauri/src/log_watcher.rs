use anyhow::Result;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Events parsed from Client.txt
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event_type", rename_all = "snake_case")]
pub enum LogEvent {
    ZoneEnter {
        timestamp: String,
        zone_name: String,
    },
    LevelUp {
        timestamp: String,
        character_name: String,
        character_class: String,
        level: u32,
    },
    Death {
        timestamp: String,
        character_name: String,
    },
    InstanceDetails {
        timestamp: String,
    },
    Login {
        timestamp: String,
    },
}

/// Log watcher state
pub struct LogWatcher {
    log_path: PathBuf,
    file_position: Arc<Mutex<u64>>,
    watcher: Option<RecommendedWatcher>,
    stop_tx: Option<Sender<()>>,
}

impl LogWatcher {
    /// Create a new log watcher for the given path
    pub fn new(log_path: PathBuf) -> Self {
        LogWatcher {
            log_path,
            file_position: Arc::new(Mutex::new(0)),
            watcher: None,
            stop_tx: None,
        }
    }

    /// Start watching the log file
    pub fn start(&mut self, app_handle: AppHandle) -> Result<()> {
        let log_path = self.log_path.clone();
        let file_position = self.file_position.clone();

        // Initialize position to end of file
        if let Ok(metadata) = std::fs::metadata(&log_path) {
            *file_position.lock().unwrap() = metadata.len();
        }

        let (stop_tx, stop_rx) = channel();
        self.stop_tx = Some(stop_tx);

        // Create channel for file change notifications
        let (tx, rx) = channel();

        // Create the file watcher
        let mut watcher = RecommendedWatcher::new(
            move |res| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_millis(500)),
        )?;

        // Watch the log file's parent directory
        if let Some(parent) = log_path.parent() {
            watcher.watch(parent, RecursiveMode::NonRecursive)?;
        }

        self.watcher = Some(watcher);

        // Spawn thread to handle file changes
        let log_path_clone = log_path.clone();
        thread::spawn(move || {
            Self::watch_loop(log_path_clone, file_position, rx, stop_rx, app_handle);
        });

        Ok(())
    }

    /// Stop watching the log file
    pub fn stop(&mut self) {
        if let Some(tx) = self.stop_tx.take() {
            let _ = tx.send(());
        }
        self.watcher = None;
    }

    /// Main watch loop
    fn watch_loop(
        log_path: PathBuf,
        file_position: Arc<Mutex<u64>>,
        rx: Receiver<notify::Event>,
        stop_rx: Receiver<()>,
        app_handle: AppHandle,
    ) {
        loop {
            // Check for stop signal
            if stop_rx.try_recv().is_ok() {
                break;
            }

            // Check for file change events
            if let Ok(_event) = rx.recv_timeout(Duration::from_millis(100)) {
                // Read new lines from the file
                if let Ok(events) = Self::read_new_lines(&log_path, &file_position) {
                    for event in events {
                        // Emit event to frontend
                        let _ = app_handle.emit("log-event", &event);
                    }
                }
            }
        }
    }

    /// Read new lines from the log file
    fn read_new_lines(log_path: &Path, file_position: &Arc<Mutex<u64>>) -> Result<Vec<LogEvent>> {
        let mut events = Vec::new();
        let file = File::open(log_path)?;
        let mut reader = BufReader::new(file);

        let mut pos = file_position.lock().unwrap();
        reader.seek(SeekFrom::Start(*pos))?;

        let mut line = String::new();
        while reader.read_line(&mut line)? > 0 {
            if let Some(event) = Self::parse_line(&line) {
                events.push(event);
            }
            line.clear();
        }

        *pos = reader.stream_position()?;
        Ok(events)
    }

    /// Parse a log line into an event
    fn parse_line(line: &str) -> Option<LogEvent> {
        lazy_static::lazy_static! {
            // Pattern: 2024/01/15 12:34:56 12345678 abc [INFO Client 1234] You have entered The Coast.
            static ref ZONE_ENTER: Regex = Regex::new(
                r"(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}).*\] You have entered (.+)\."
            ).unwrap();

            // Pattern: 2024/01/15 12:34:56 12345678 abc [INFO Client 1234] CharName (Witch) is now level 10
            static ref LEVEL_UP: Regex = Regex::new(
                r"(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}).*\] (.+?) \((.+?)\) is now level (\d+)"
            ).unwrap();

            // Pattern: 2024/01/15 12:34:56 12345678 abc [INFO Client 1234] CharName has been slain.
            static ref DEATH: Regex = Regex::new(
                r"(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}).*\] (.+?) has been slain\."
            ).unwrap();

            // Pattern: Got Instance Details
            static ref INSTANCE_DETAILS: Regex = Regex::new(
                r"(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}).*\] Got Instance Details"
            ).unwrap();

            // Pattern: Connecting to instance server
            static ref LOGIN: Regex = Regex::new(
                r"(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}).*\] Connecting to instance server"
            ).unwrap();
        }

        // Try to match zone enter
        if let Some(caps) = ZONE_ENTER.captures(line) {
            return Some(LogEvent::ZoneEnter {
                timestamp: caps[1].to_string(),
                zone_name: caps[2].to_string(),
            });
        }

        // Try to match level up
        if let Some(caps) = LEVEL_UP.captures(line) {
            return Some(LogEvent::LevelUp {
                timestamp: caps[1].to_string(),
                character_name: caps[2].to_string(),
                character_class: caps[3].to_string(),
                level: caps[4].parse().unwrap_or(1),
            });
        }

        // Try to match death
        if let Some(caps) = DEATH.captures(line) {
            return Some(LogEvent::Death {
                timestamp: caps[1].to_string(),
                character_name: caps[2].to_string(),
            });
        }

        // Try to match instance details
        if let Some(caps) = INSTANCE_DETAILS.captures(line) {
            return Some(LogEvent::InstanceDetails {
                timestamp: caps[1].to_string(),
            });
        }

        // Try to match login
        if let Some(caps) = LOGIN.captures(line) {
            return Some(LogEvent::Login {
                timestamp: caps[1].to_string(),
            });
        }

        None
    }
}

/// Detect the POE log path automatically
pub fn detect_log_path() -> Option<PathBuf> {
    let possible_paths = [
        // Steam
        r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile\logs\Client.txt",
        // Standalone
        r"C:\Program Files (x86)\Grinding Gear Games\Path of Exile\logs\Client.txt",
        // Epic Games
        r"C:\Program Files\Epic Games\PathOfExile\logs\Client.txt",
        // Common custom Steam library locations
        r"D:\Steam\steamapps\common\Path of Exile\logs\Client.txt",
        r"D:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt",
        r"E:\Steam\steamapps\common\Path of Exile\logs\Client.txt",
        r"E:\SteamLibrary\steamapps\common\Path of Exile\logs\Client.txt",
    ];

    for path_str in &possible_paths {
        let path = PathBuf::from(path_str);
        if path.exists() {
            return Some(path);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_zone_enter() {
        let line = "2024/01/15 12:34:56 12345678 abc [INFO Client 1234] You have entered The Coast.";
        let event = LogWatcher::parse_line(line);
        assert!(matches!(event, Some(LogEvent::ZoneEnter { zone_name, .. }) if zone_name == "The Coast"));
    }

    #[test]
    fn test_parse_level_up() {
        let line = "2024/01/15 12:34:56 12345678 abc [INFO Client 1234] TestChar (Witch) is now level 10";
        let event = LogWatcher::parse_line(line);
        assert!(matches!(
            event,
            Some(LogEvent::LevelUp { character_name, character_class, level, .. })
            if character_name == "TestChar" && character_class == "Witch" && level == 10
        ));
    }

    #[test]
    fn test_parse_death() {
        let line = "2024/01/15 12:34:56 12345678 abc [INFO Client 1234] TestChar has been slain.";
        let event = LogWatcher::parse_line(line);
        assert!(matches!(event, Some(LogEvent::Death { character_name, .. }) if character_name == "TestChar"));
    }
}
