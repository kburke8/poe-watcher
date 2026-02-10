# POE Watcher - Engineering Rules

## Project Overview

POE Watcher is a local desktop application for tracking Path of Exile speedruns. It monitors the game's Client.txt log file, captures breakpoints during gameplay, creates snapshots for analysis, and provides an in-game overlay for live timer display.

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Desktop Framework | Tauri 2.x | Low memory footprint, Rust backend |
| Frontend | React 19 + TypeScript | Type safety, component reuse |
| State Management | Zustand | Lightweight, simple API |
| Styling | Tailwind CSS v4 | Rapid UI development |
| Database | SQLite (rusqlite) | Single file, portable |
| File Watching | Rust `notify` crate | Native Windows API |

## Architecture Decisions

### Backend (Rust)
- All file I/O and heavy processing happens in Rust
- Log file watching uses the `notify` crate with debouncing
- Database operations are synchronous within Rust, async from frontend
- API client implements rate limiting with token bucket algorithm
- Overlay window created dynamically via `WebviewWindowBuilder` (not declared in tauri.conf.json)
- Cross-window communication uses `sync_overlay_state` command to emit events through Rust

### Frontend (React)
- State split into `runStore` (timer/splits), `settingsStore` (config/breakpoints), and `snapshotStore` (snapshots)
- Tauri events bridge log watcher to React state
- All time values stored as milliseconds (i64)
- Timer updates via `requestAnimationFrame` for smooth display
- Breakpoint configuration uses a wizard system (`BreakpointWizard` + `wizardRoutes.ts`) with category/verbosity/snapshot-frequency steps
- Category is derived from wizard config via `getWizardCategory()` in `wizardRoutes.ts`

### Overlay Window
- Separate Tauri window with its own HTML entry point (`overlay.html`) and React root (`OverlayApp.tsx`)
- Always-on-top, transparent, decorationless
- Receives state from main window via Rust event relay (`overlay-state-update`)
- Supports lock mode (click-through) and position persistence
- Global shortcuts: `Ctrl+O` toggle, `Ctrl+Shift+O` lock toggle

### Database Schema
- `runs`: Speedrun attempts with character info
- `splits`: Individual split times per breakpoint
- `snapshots`: Full character state at each split
- `personal_bests`: Best times per category/class
- `gold_splits`: Best segment times per breakpoint

## Coding Standards

### Rust
- Use `anyhow::Result` for fallible functions
- Prefer `once_cell` for lazy statics
- All database queries wrapped in transactions where appropriate
- Log events with structured data (serde serialization)

### TypeScript
- Strict mode enabled
- No `any` types - use proper interfaces
- Format times as `mm:ss.cc` or `h:mm:ss.cc`
- Component files named `PascalCase.tsx`

### CSS/Tailwind
- Use CSS variables for theming (`--color-poe-gold`, etc.)
- Dark theme only (POE aesthetic)
- Timer text uses `font-variant-numeric: tabular-nums`

## File Structure

```
src/                    # React frontend
  components/           # UI components by feature
    Overlay/            # Overlay window components
    Settings/           # Settings + BreakpointWizard + RouteCustomizations
  stores/               # Zustand stores
  hooks/                # Custom React hooks (useOverlaySync, useHotkeys, useTauriEvents)
  types/                # TypeScript interfaces
  config/               # Static configuration (breakpoints.ts, wizardRoutes.ts)
  utils/                # Utility functions (pobExport.ts)

src-tauri/src/          # Rust backend
  db/                   # Database module
    migrations/         # SQL migration files
  api_client.rs         # POE API integration
  log_watcher.rs        # Client.txt monitoring
  commands.rs           # Tauri IPC commands
```

## Key Constraints

1. **Public API Only**: App uses POE public API - user must set profile to public
2. **No OAuth**: Avoiding OAuth complexity for MVP
3. **Windows Focus**: Primary target, log paths assume Windows
4. **Single Instance**: Only one log watcher runs at a time
5. **Offline First**: Timer continues if API fails, snapshots queue for retry

## Don'ts

- Don't store API keys or sensitive data in plain text
- Don't make API calls without rate limiting
- Don't block the UI thread with database operations
- Don't parse log lines without regex validation
- Don't assume POE installation location - always allow manual config

## Testing

- Rust: Unit tests for log parsing patterns
- Frontend: Manual testing for now (Playwright later)
- API: Mock responses for rate limit testing
- `simulate_snapshot` command exists in `commands.rs` for dev testing but is not registered in the production invoke handler

## Build & Run

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build
```

## Known Issues & TODOs

- [ ] Lab completion detection needs refinement
- [ ] Zone act disambiguation uses heuristics

## Updates

This file should be updated when:
- New technology is added
- Architecture decisions change
- New constraints are discovered
- Patterns emerge that should be standardized
