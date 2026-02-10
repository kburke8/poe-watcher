# Claude Code Instructions for POE Watcher

## Project Overview

POE Watcher is a Tauri 2.x desktop application for tracking Path of Exile speedruns. It monitors the game's Client.txt log file, captures breakpoints, creates character snapshots, and exports to Path of Building. It includes an always-on-top overlay window for in-game timer display.

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
src/components/Overlay/  # Overlay window components
src/config/              # Static config (breakpoints, wizard routes)
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

- `lib.rs` - Tauri app setup, plugin registration, global hotkey setup, overlay window lifecycle
- `commands.rs` - IPC commands exposed to frontend
- `log_watcher.rs` - File system monitoring for Client.txt
- `api_client.rs` - POE public API with rate limiting and caching
- `db/mod.rs` - SQLite connection management
- `db/schema.rs` - Database models and queries

### React Frontend

- `stores/runStore.ts` - Timer, splits, and run state
- `stores/settingsStore.ts` - User settings, breakpoints, and wizard config
- `stores/snapshotStore.ts` - Snapshot data and loading
- `hooks/useTauriEvents.ts` - Backend event listeners, split triggering
- `hooks/useHotkeys.ts` - Global keyboard shortcuts (including overlay toggle)
- `hooks/useOverlaySync.ts` - Syncs timer/split state to overlay window via `sync_overlay_state`
- `components/Timer/` - Main timer UI with splits display
- `components/Settings/` - Configuration UI (BreakpointWizard, RouteCustomizations, SettingsView)
- `components/Overlay/` - Overlay window components (OverlayTimer, OverlayZone, OverlaySplit, OverlayBreakpoints)
- `components/Snapshot/` - Snapshot viewer, equipment grid, passive tree
- `components/History/` - Run history and analytics
- `config/breakpoints.ts` - Default breakpoint definitions and presets
- `config/wizardRoutes.ts` - Wizard-based breakpoint generation from route config
- `utils/pobExport.ts` - Path of Building XML generation

### Overlay Window

The overlay is a separate Tauri window (`overlay.html` / `OverlayApp.tsx`) that displays timer, current zone, last split delta, and upcoming breakpoints. Key details:

- Created dynamically via `open_overlay` command using `WebviewWindowBuilder`
- Always-on-top, transparent, decorationless, non-resizable (320x180)
- State is relayed from the main window via `sync_overlay_state` command, which emits `overlay-state-update` events to the overlay window
- `useOverlaySync` hook in the main window sends state on meaningful changes + periodic heartbeat (2s)
- Position is persisted to database via `set_overlay_position` / `get_overlay_position`
- Lock mode (`Ctrl+Shift+O`): makes overlay click-through via `setIgnoreCursorEvents`
- Toggle via `Ctrl+O` global shortcut or settings UI button

### Breakpoint Wizard System

The wizard (`BreakpointWizard.tsx` + `wizardRoutes.ts`) provides guided breakpoint configuration:

- **3-step wizard**: Category (end act + run type) -> Splits (verbosity level) -> Snapshots (capture frequency)
- **WizardConfig** type includes:
  - `endAct`: 5 or 10
  - `runType`: 'any_percent' or 'hundred_percent'
  - `verbosity`: 'every_zone' | 'key_zones' | 'bosses_only' | 'acts_only'
  - `snapshotFrequency`: 'bosses_only' | 'acts_only'
  - `routes`: per-act routing variants (early_dweller, early_crypt, kaom_first, etc.)
- **`generateBreakpoints(config)`** in `wizardRoutes.ts` builds the full breakpoint list from config
- **`getWizardCategory(config)`** derives the run category string (e.g., "Act 10 Any%")
- **`RouteCustomizations`** is a separate collapsible component in settings for fine-tuning per-act route variants
- Wizard config is stored in `settingsStore` and persisted to localStorage
- When `setWizardConfig` is called, it regenerates breakpoints from the config

### Tauri IPC Commands

Commands are defined in `commands.rs` and invoked from React:

**Settings:**
- `get_settings` / `save_settings`
- `detect_log_path_cmd` / `browse_log_path`

**Log Watcher:**
- `start_log_watcher` / `stop_log_watcher`
- `set_log_poll_fast` - Toggle between normal and fast polling (for Kitava triggers)

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

**Overlay:**
- `open_overlay` / `close_overlay` / `toggle_overlay` - Window lifecycle
- `set_overlay_position` / `get_overlay_position` - Position persistence
- `sync_overlay_state` - Relay timer/split state to overlay via Rust events

### Events

The Rust backend emits events to the frontend:
- `log-event` - Parsed log events (zone_enter, level_up, death, login, kitava_affliction)
- `settings-loaded` - Initial settings from database
- `split-trigger` - Manual or backend-triggered splits
- `snapshot-capturing` - Snapshot capture started
- `snapshot-complete` - Snapshot successfully captured
- `snapshot-failed` - Snapshot capture failed
- `global-shortcut` - Global hotkey pressed (toggle-timer, reset-timer, manual-snapshot, toggle-overlay, toggle-overlay-lock)
- `overlay-state-update` - Timer/split state sent to overlay window (emitted by `sync_overlay_state`)

### Global Shortcuts

Registered in `lib.rs` setup:
- `Ctrl+Space` - Toggle timer (start/pause)
- `Ctrl+Shift+Space` - Reset timer
- `Ctrl+Alt+Space` - Manual snapshot capture
- `Ctrl+O` - Toggle overlay window
- `Ctrl+Shift+O` - Toggle overlay lock (click-through)

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
- Overlay state sync uses `invoke('sync_overlay_state')` which goes through Rust to emit to the overlay window - direct window-to-window communication is not available in Tauri 2.x

## Testing

Currently manual testing only. No automated test suite yet.

## Common Issues

- **MSVC link.exe not found**: Run from VS Developer Command Prompt
- **Disk space errors**: Rust debug builds are large (~1GB)
- **Hot reload not working**: Rust changes require full rebuild
- **Split times stuck**: Ensure calculating actual elapsed time, not stale `timer.elapsedMs`
- **Wrong class in PoB export**: Check `deriveClassAndAscendancy()` handles ascendancy-as-class
- **Snapshot capture fails**: Check API response parsing, mastery_effects format
- **Overlay not receiving state**: Ensure `sync_overlay_state` is being called and overlay window label is "overlay"
