# Claude Code Instructions for POE Watcher

## Project Overview

POE Watcher is a Tauri 2.x desktop application for tracking Path of Exile speedruns. It monitors the game's Client.txt log file, captures breakpoints, and creates snapshots for speedrun analysis.

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
python/                  # PoB sidecar (future)
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

- `lib.rs` - Tauri app setup, plugin registration
- `commands.rs` - IPC commands exposed to frontend
- `log_watcher.rs` - File system monitoring for Client.txt
- `api_client.rs` - POE public API with rate limiting
- `db/mod.rs` - SQLite connection management
- `db/schema.rs` - Database models and queries

### React Frontend

- `stores/runStore.ts` - Timer and run state
- `stores/settingsStore.ts` - User settings
- `hooks/useTauriEvents.ts` - Backend event listeners
- `components/Timer/` - Main timer UI
- `components/Settings/` - Configuration UI

### Tauri IPC Commands

Commands are defined in `commands.rs` and invoked from React:
- `get_settings` / `save_settings`
- `detect_log_path_cmd`
- `start_log_watcher` / `stop_log_watcher`
- `create_run` / `complete_run` / `get_runs`
- `add_split` / `get_splits`
- `fetch_characters` / `fetch_character_data`

### Events

The Rust backend emits events to the frontend:
- `log-event` - Parsed log events (zone enter, level up, death)

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

## Important Constraints

- POE API requires public profile - handle 403 gracefully
- Rate limit: 5 req/sec, burst 10 - use the token bucket in api_client.rs
- Log file may not exist - always check before watching
- Timer accuracy relies on requestAnimationFrame
- All times stored as milliseconds (i64)

## Testing

Currently manual testing only. Future:
- Rust unit tests for log parsing
- React component tests with Vitest

## Common Issues

- **MSVC link.exe not found**: Run from VS Developer Command Prompt
- **Disk space errors**: Rust debug builds are large (~1GB)
- **Hot reload not working**: Rust changes require full rebuild
