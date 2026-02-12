# Development Guide

> Auto-generated from `package.json` and project configuration.
> Last updated: 2026-02-11

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Vite dev server (frontend only, no Tauri backend) |
| `build` | `npm run build` | TypeScript check + Vite production build |
| `preview` | `npm run preview` | Preview the production build locally |
| `tauri` | `npm run tauri` | Tauri CLI passthrough (e.g., `npm run tauri dev`, `npm run tauri build`) |

### Compound Commands

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Full-stack dev: Vite hot-reload frontend + Rust backend in debug mode |
| `npm run tauri build` | Production build: compiles frontend + Rust, produces installers |
| `npm run tauri build -- --bundles msi` | Build MSI installer only |
| `npm run tauri build -- --bundles nsis` | Build NSIS installer only |

## Environment Setup

### Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| Rust | 1.70+ | [rustup.rs](https://rustup.rs/) |
| Visual Studio Build Tools | 2019+ | [download](https://visualstudio.microsoft.com/visual-cpp-build-tools/) |

Visual Studio Build Tools must include the **C++ workload** (MSVC v142+ and Windows SDK).

### Environment Variables

This project does not use `.env` files. All configuration is handled through:

- **Tauri config**: `src-tauri/tauri.conf.json` (build settings, CSP, updater)
- **Vite config**: `vite.config.ts` (dev server, uses `TAURI_DEV_HOST` if set)
- **Runtime settings**: Stored in SQLite database, managed via the Settings UI
- **CI secrets**: `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are GitHub Secrets (never committed)

### First-Time Setup

```bash
git clone https://github.com/kburke8/poe-watcher.git
cd poe-watcher
npm install
```

### Running in Development

```bash
# Full-stack (recommended)
npm run tauri dev

# Frontend-only (for UI work without Rust backend)
npm run dev
# Opens at http://localhost:1420
```

**Notes:**
- Rust changes require a full restart of `npm run tauri dev`
- Frontend changes hot-reload automatically
- First build downloads Rust dependencies (~3-10 min)
- Debug builds consume ~2-3 GB of disk space

## Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Run `npm run tauri dev` for full-stack development
3. Make changes - frontend hot-reloads, Rust requires restart
4. Test manually (no automated test suite yet)
5. Commit with descriptive messages
6. Open a Pull Request

### Adding a Tauri Command

1. Add function in `src-tauri/src/commands.rs`:
   ```rust
   #[tauri::command]
   pub async fn my_command(arg: String) -> Result<String, String> {
       Ok(format!("Hello, {}", arg))
   }
   ```

2. Register in `src-tauri/src/lib.rs` invoke handler

3. Call from React:
   ```typescript
   import { invoke } from '@tauri-apps/api/core';
   const result = await invoke<string>('my_command', { arg: 'value' });
   ```

### Adding a View

1. Create component in `src/components/NewView/`
2. Add to `ViewMode` type in `src/types/index.ts`
3. Add case in `App.tsx` `renderView()`
4. Add nav item in `Sidebar.tsx`

### Adding a Database Table

1. Create migration SQL in `src-tauri/src/db/migrations/`
2. Add model struct and methods in `src-tauri/src/db/schema.rs`
3. Export from `src-tauri/src/db/mod.rs`

## Testing

**Status:** Manual testing only. No automated test suite.

Manual test checklist:
- Timer starts/stops/resets correctly
- Splits trigger on zone changes
- Snapshots capture via POE API
- PoB export produces valid XML
- Overlay window opens, syncs state, and persists position
- Settings save and restore correctly
- Run history filters and displays properly

## Dependencies

### Frontend (package.json)

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework |
| `zustand` | State management |
| `@tauri-apps/api` | Tauri IPC bridge |
| `@tauri-apps/plugin-dialog` | Native file dialogs |
| `@tauri-apps/plugin-opener` | Open URLs in browser |
| `@tauri-apps/plugin-process` | Process control (restart) |
| `@tauri-apps/plugin-updater` | Auto-update from GitHub Releases |
| `@tanstack/react-query` | Async data fetching |
| `date-fns` | Date formatting |
| `recharts` | Charts for run analytics |
| `pako` | Gzip compression (PoB export) |

### Backend (Cargo.toml)

| Crate | Purpose |
|-------|---------|
| `tauri` | Desktop framework |
| `rusqlite` | SQLite database |
| `reqwest` | HTTP client (POE API) |
| `notify` | File system watcher (Client.txt) |
| `tokio` | Async runtime |
| `serde` / `serde_json` | Serialization |
| `regex` | Log parsing |
| `chrono` | Date/time handling |

## Code Style

- **TypeScript/React**: Functional components, hooks, Zustand stores, Tailwind CSS
- **Rust**: `cargo fmt`, `Result` types, async `#[tauri::command]`
- No linter configured yet - follow existing patterns
