# Contributing to POE Watcher

Thanks for your interest in contributing! This document covers how to set up your development environment and build releases.

## Development Setup

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **Rust** 1.70+ ([install via rustup](https://rustup.rs/))
- **Visual Studio Build Tools** with C++ workload ([download](https://visualstudio.microsoft.com/visual-cpp-build-tools/))

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/poe-watcher.git
cd poe-watcher

# Install Node.js dependencies
npm install
```

### Running in Development Mode

```bash
npm run tauri dev
```

This starts:
- Vite dev server with hot reload for the frontend
- Rust backend in debug mode

**Note:** Rust changes require a full rebuild. Frontend changes hot reload automatically.

### Frontend-Only Development

For UI work without the Tauri backend:

```bash
npm run dev
```

Opens at `http://localhost:1420`. Backend features won't work, but you can develop UI components.

## Building for Release

### Quick Build

```bash
npm run tauri build
```

This produces installers in `src-tauri/target/release/bundle/`:

```
src-tauri/target/release/
├── poe-watcher.exe                           # Standalone executable
└── bundle/
    ├── msi/
    │   └── POE Watcher_0.1.0_x64_en-US.msi   # MSI installer
    └── nsis/
        └── POE Watcher_0.1.0_x64-setup.exe   # NSIS installer
```

### Build Specific Installer

```bash
# MSI only
npm run tauri build -- --bundles msi

# NSIS only
npm run tauri build -- --bundles nsis
```

### Build Requirements

| Requirement | Size | Notes |
|-------------|------|-------|
| Disk space | ~2-3 GB | Rust debug builds are large |
| RAM | 4+ GB | Rust compilation is memory-intensive |
| Time | 3-10 min | First build downloads dependencies |

### Release Checklist

Before building a release:

1. **Update version** in `src-tauri/tauri.conf.json`:
   ```json
   "version": "0.2.0"
   ```

2. **Test the app** thoroughly:
   - Timer starts/stops correctly
   - Splits trigger on zone changes
   - Snapshots capture successfully
   - PoB export works

3. **Build the release**:
   ```bash
   npm run tauri build
   ```

4. **Test the installer**:
   - Install on a clean system if possible
   - Verify app launches
   - Check that data persists between sessions

## Project Structure

```
poe-watcher/
├── src/                    # React frontend (TypeScript)
│   ├── components/         # UI components
│   ├── stores/             # Zustand state stores
│   ├── hooks/              # React hooks
│   ├── utils/              # Utilities (PoB export, etc.)
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # App setup, plugins
│   │   ├── commands.rs     # Tauri IPC commands
│   │   ├── api_client.rs   # POE API client
│   │   ├── log_watcher.rs  # Client.txt monitor
│   │   └── db/             # SQLite database
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── package.json            # Node.js dependencies
└── vite.config.ts          # Vite configuration
```

## Code Style

### TypeScript/React

- Functional components with hooks
- Zustand for state management
- Tailwind CSS for styling (use CSS variables for theming)

### Rust

- Standard Rust formatting (`cargo fmt`)
- Use `Result` types for error handling
- Async commands with `#[tauri::command]`

## Adding Features

### Adding a new Tauri command

1. Add the function in `src-tauri/src/commands.rs`:
   ```rust
   #[tauri::command]
   pub async fn my_command(arg: String) -> Result<String, String> {
       Ok(format!("Hello, {}", arg))
   }
   ```

2. Register in `src-tauri/src/lib.rs`:
   ```rust
   .invoke_handler(tauri::generate_handler![
       my_command,
       // ... other commands
   ])
   ```

3. Call from React:
   ```typescript
   import { invoke } from '@tauri-apps/api/core';
   const result = await invoke<string>('my_command', { arg: 'World' });
   ```

### Adding a new view

1. Create component in `src/components/NewView/`
2. Add to `ViewMode` type in `src/types/index.ts`
3. Add case in `App.tsx` `renderView()`
4. Add nav item in `Sidebar.tsx`

### Adding a database table

1. Create migration in `src-tauri/src/db/migrations/`
2. Add model and methods in `src-tauri/src/db/schema.rs`
3. Export from `src-tauri/src/db/mod.rs`

## Troubleshooting

### "MSVC link.exe not found"

Run from Visual Studio Developer Command Prompt, or ensure MSVC is in your PATH.

### Build fails with disk space error

Rust debug builds are large (~1-2 GB). Clear old builds:
```bash
cargo clean
```

### Hot reload not working for Rust changes

Rust requires a full rebuild. Stop and restart `npm run tauri dev`.

### WebView2 errors on Windows

Ensure WebView2 runtime is installed. It's included in Windows 10 (version 1803+) and Windows 11.

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test thoroughly
5. Commit with descriptive messages
6. Push to your fork
7. Open a Pull Request

## Code Signing (Maintainers)

To sign releases (eliminates SmartScreen warnings):

1. Obtain a code signing certificate (DigiCert, Sectigo, SSL.com)

2. Add to `src-tauri/tauri.conf.json`:
   ```json
   {
     "bundle": {
       "windows": {
         "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
         "digestAlgorithm": "sha256",
         "timestampUrl": "http://timestamp.digicert.com"
       }
     }
   }
   ```

3. Build with certificate available in Windows certificate store

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
