# Claude Code Instructions for POE Watcher

## Project Overview

POE Watcher is a Tauri 2.x desktop application for tracking Path of Exile speedruns. It monitors the game's Client.txt log file, captures breakpoints, creates character snapshots, and exports to Path of Building.

## Technology Stack

- **Backend**: Rust (Tauri 2.x)
- **Frontend**: React 19 + TypeScript
- **State**: Zustand
- **Styling**: Tailwind CSS v4
- **Database**: SQLite via rusqlite
- **Build**: Vite

## Key Directories

```
src/                     # React frontend
src-tauri/src/           # Rust backend
src-tauri/src/db/        # Database module
```

## Development Commands

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build

# Frontend only (for UI development)
npm run dev
```

## Build Requirements

On Windows, requires Visual Studio Build Tools with C++ workload. Run builds from VS Developer Command Prompt or ensure MSVC is in PATH.

## Architecture Notes

### Rust Backend

- `lib.rs` - Tauri app setup, plugin registration, global hotkey setup
- `commands.rs` - IPC commands exposed to frontend
- `log_watcher.rs` - File system monitoring for Client.txt
- `api_client.rs` - POE public API with rate limiting and caching
- `db/mod.rs` - SQLite connection management
- `db/schema.rs` - Database models and queries

### React Frontend

- `stores/runStore.ts` - Timer, splits, and run state
- `stores/settingsStore.ts` - User settings and breakpoints
- `stores/snapshotStore.ts` - Snapshot data and loading
- `hooks/useTauriEvents.ts` - Backend event listeners, split triggering
- `hooks/useHotkeys.ts` - Global keyboard shortcuts
- `components/Timer/` - Main timer UI with splits display
- `components/Settings/` - Configuration UI
- `components/Snapshot/` - Snapshot viewer, equipment grid, passive tree
- `components/History/` - Run history and analytics
- `utils/pobExport.ts` - Path of Building XML generation

### Tauri IPC Commands

Commands are defined in `commands.rs` and invoked from React:

**Settings:**
- `get_settings` / `save_settings`
- `detect_log_path_cmd` / `browse_log_path`

**Log Watcher:**
- `start_log_watcher` / `stop_log_watcher`

**Runs:**
- `create_run` / `complete_run` / `get_runs` / `get_run` / `delete_run`
- `update_run_character` - Update character name/class after detection
- `get_runs_filtered` / `get_run_stats` / `get_split_stats`
- `create_reference_run`

**Splits:**
- `add_split` / `get_splits` / `manual_split`

**Snapshots:**
- `create_snapshot` / `get_snapshots` / `get_snapshot`
- `capture_snapshot` - Fetch from POE API and store

**Personal Bests:**
- `get_personal_bests` / `get_gold_splits`

**API:**
- `fetch_characters` / `fetch_character_data` / `fetch_passive_tree`
- `upload_to_pobbin` - Share build on pobb.in
- `proxy_image` - CORS bypass for item icons

### Events

The Rust backend emits events to the frontend:
- `log-event` - Parsed log events (zone_enter, level_up, death, login)
- `settings-loaded` - Initial settings from database
- `split-trigger` - Manual or backend-triggered splits
- `snapshot-capturing` - Snapshot capture started
- `snapshot-complete` - Snapshot successfully captured
- `snapshot-failed` - Snapshot capture failed
- `global-shortcut` - Global hotkey pressed (Ctrl+Space)

## Code Patterns

### Adding a new Tauri command

1. Add function in `commands.rs`:
```rust
#[tauri::command]
pub async fn my_command(arg: String) -> Result<String, String> {
    // implementation
}
```

2. Register in `lib.rs`:
```rust
.invoke_handler(tauri::generate_handler![my_command, ...])
```

3. Call from React:
```typescript
import { invoke } from '@tauri-apps/api/core';
const result = await invoke<string>('my_command', { arg: 'value' });
```

### Adding a database table

1. Add migration SQL in `src-tauri/src/db/migrations/`
2. Add model struct and methods in `schema.rs`
3. Export from `db/mod.rs`

### Adding a new view

1. Create component in `src/components/NewView/`
2. Add to `ViewMode` type in `types/index.ts`
3. Add case in `App.tsx` renderView()
4. Add nav item in `Sidebar.tsx`

### PoB Export

The `pobExport.ts` file handles Path of Building integration:
- `generatePobXml()` - Single snapshot to PoB XML
- `generateMultiSnapshotPobXml()` - Multiple snapshots with Loadouts
- `deriveClassAndAscendancy()` - Handles POE log storing ascendancy as class
- `exportToPob()` / `exportAllToPob()` - Copy to clipboard
- `shareOnPobbIn()` / `shareAllOnPobbIn()` - Upload to pobb.in

Key insight: POE logs capture **ascendancy names** (e.g., "Pathfinder") in level-up events, not base class. The `deriveClassAndAscendancy()` function handles this by checking if `rawClass` is actually an ascendancy name.

## Important Constraints

- POE API requires public profile - handle 403 gracefully
- Rate limit: 5 req/sec, burst 10 - use the token bucket in api_client.rs
- Log file may not exist - always check before watching
- Timer accuracy: Use `Date.now() - timer.startTime` for accurate elapsed time, not `timer.elapsedMs` which only updates during UI renders
- All times stored as milliseconds (i64)
- Character name detection happens on level_up events - update both local state and database
- Mastery effects from API can be array or map format - use custom deserializer

## Testing

Currently manual testing only. Use the "Simulate" button in Snapshots view to create test snapshots from existing POE characters.

## Common Issues

- **MSVC link.exe not found**: Run from VS Developer Command Prompt
- **Disk space errors**: Rust debug builds are large (~1GB)
- **Hot reload not working**: Rust changes require full rebuild
- **Split times stuck**: Ensure calculating actual elapsed time, not stale `timer.elapsedMs`
- **Wrong class in PoB export**: Check `deriveClassAndAscendancy()` handles ascendancy-as-class
- **Snapshot capture fails**: Check API response parsing, mastery_effects format
