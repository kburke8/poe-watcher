# POE Watcher

A local desktop application for tracking Path of Exile speedruns. Monitor your gameplay, capture splits at key breakpoints, and analyze your builds with Path of Building integration.

## Features

- **Live Timer** - Accurate speedrun timer with split tracking
- **Log Monitoring** - Automatically detects zone changes, level ups, and deaths from Client.txt
- **Character Snapshots** - Captures equipment, skills, and passive tree at each breakpoint
- **POE API Integration** - Fetches character data (requires public profile)
- **Personal Bests** - Track and compare against your best runs
- **Gold Splits** - Best segment times highlighted
- **Dark Theme** - POE-inspired UI design

## Requirements

- Windows 10/11
- Path of Exile installed
- POE profile set to **public** (for character data fetching)

## Installation

### From Release

1. Download the latest `.msi` installer from Releases
2. Run the installer
3. Launch POE Watcher from the Start Menu

### From Source

#### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with C++ workload

#### Build Steps

```bash
# Clone the repository
git clone https://github.com/yourusername/poe-watcher.git
cd poe-watcher

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Configuration

1. Launch POE Watcher
2. Go to **Settings** (gear icon)
3. Set your **Client.txt Log Path**:
   - Steam: `C:\Program Files (x86)\Steam\steamapps\common\Path of Exile\logs\Client.txt`
   - Standalone: `C:\Program Files (x86)\Grinding Gear Games\Path of Exile\logs\Client.txt`
   - Or click **Auto-detect**
4. Enter your **POE Account Name**
5. Configure breakpoints as desired
6. Click **Save Settings**

## Usage

### Timer Controls

- **Start** - Begin timing a new run
- **Pause** - Pause the timer (manual)
- **Split** - Manual split (automatic splits trigger on zone changes)
- **Reset** - Clear current run
- **End Run** - Save completed run

### Automatic Splits

The app monitors Client.txt for these events:
- Zone transitions (e.g., entering towns, boss arenas)
- Level milestones (10, 20, 30, etc.)
- Act completions
- Lab completions

### Breakpoint Configuration

Enable/disable specific breakpoints in Settings. Default splits follow the standard speedrun route through Acts 1-10.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Desktop Framework | Tauri 2.x |
| Frontend | React 19 + TypeScript |
| State Management | Zustand |
| Styling | Tailwind CSS v4 |
| Database | SQLite (rusqlite) |
| File Watching | Rust `notify` crate |

## Project Structure

```
poe-watcher/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── stores/             # Zustand state stores
│   ├── hooks/              # Custom React hooks
│   ├── types/              # TypeScript interfaces
│   └── config/             # Configuration files
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── db/             # SQLite database
│   │   ├── api_client.rs   # POE API client
│   │   ├── log_watcher.rs  # Client.txt monitor
│   │   └── commands.rs     # Tauri IPC commands
│   └── Cargo.toml
├── python/                 # PoB sidecar (future)
└── package.json
```

## API Rate Limiting

The app respects GGG's API rate limits:
- 5 requests/second with burst of 10
- Automatic retry with exponential backoff on 429 responses
- 30-second response caching

## Troubleshooting

### "Profile is private" error
Set your POE profile to public at [pathofexile.com/account/privacy](https://www.pathofexile.com/account/privacy)

### Log file not found
Verify the path in Settings. The file must exist and be readable.

### Timer not starting automatically
Ensure the log watcher is running (check the status indicator in the app).

## Contributing

Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
