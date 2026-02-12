# Runbook

> Operational guide for releasing, troubleshooting, and maintaining POE Watcher.
> Last updated: 2026-02-11

## Release Procedure

### 1. Pre-Release Checklist

- [ ] Update version in all locations:
  - `package.json` (`"version"`)
  - `src-tauri/tauri.conf.json` (`"version"`)
  - `src-tauri/Cargo.toml` (`version`)
- [ ] Update `CHANGELOG.md` with new version entry
- [ ] Manual test pass (see Testing section in [CONTRIB.md](CONTRIB.md))
- [ ] Commit version bump: `git commit -m "chore: bump version to X.Y.Z"`

### 2. Create Release

```bash
# Tag the release
git tag vX.Y.Z
git push origin vX.Y.Z
```

This triggers the GitHub Actions release workflow (`.github/workflows/release.yml`):
1. Checks out code on `windows-latest`
2. Sets up Node.js 20 + Rust stable
3. Runs `npm ci` and `tauri build`
4. Signs artifacts with `TAURI_SIGNING_PRIVATE_KEY` (GitHub Secret)
5. Creates a **draft** GitHub Release with installers + `latest.json` for auto-updater

### 3. Post-Release

- [ ] Review the draft release on GitHub
- [ ] Edit release notes (replace default body with changelog entries)
- [ ] Publish the release (moves from draft to public)
- [ ] Verify auto-updater: install previous version, confirm it detects the update

### Release Artifacts

| File | Type | Purpose |
|------|------|---------|
| `POE Watcher_X.Y.Z_x64_en-US.msi` | MSI installer | Standard Windows installer |
| `POE Watcher_X.Y.Z_x64-setup.exe` | NSIS installer | Alternative installer |
| `latest.json` | JSON | Auto-updater manifest |
| `*.sig` | Signature | Tauri update signatures |

### Local Build (without CI)

```bash
npm run tauri build
```

Output in `src-tauri/target/release/bundle/`.

## Auto-Updater

The app checks for updates on startup via the Tauri updater plugin:
- **Endpoint**: `https://github.com/kburke8/poe-watcher/releases/latest/download/latest.json`
- **Install mode**: Passive (installs on next app restart)
- **Public key**: Configured in `tauri.conf.json` (`plugins.updater.pubkey`)
- **Signing**: Private key stored in GitHub Secrets, never committed

### Updater Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Update not detected | `latest.json` missing or wrong version | Check GitHub Release assets include `latest.json` |
| Signature mismatch | Wrong signing key used | Ensure `TAURI_SIGNING_PRIVATE_KEY` matches the pubkey in config |
| Update fails silently | Network/firewall blocking GitHub | Check connectivity to `github.com` |

## Common Issues and Fixes

### Build Failures

| Issue | Cause | Fix |
|-------|-------|-----|
| `MSVC link.exe not found` | Missing C++ build tools | Install VS Build Tools with C++ workload, or run from Developer Command Prompt |
| Disk space error | Debug builds ~2-3 GB | Run `cargo clean` in `src-tauri/` |
| `WebView2` errors | Missing runtime | Install WebView2 Runtime (included in Win10 1803+ / Win11) |
| Rust compile errors after update | Lockfile drift | Delete `src-tauri/Cargo.lock` and rebuild |

### Runtime Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Profile is private" | POE account privacy settings | Set profile to public at [pathofexile.com/account/privacy](https://www.pathofexile.com/account/privacy) |
| Log file not found | Wrong path or file missing | Verify path in Settings, use Auto-detect |
| Timer not starting | Log watcher not running | Check status indicator in app; restart watcher |
| Snapshots not capturing | Account name wrong or API down | Verify account name; check POE API status |
| Wrong class in PoB | Ascendancy detection edge case | `deriveClassAndAscendancy()` handles this; file a bug if incorrect |
| Overlay not syncing | Window label mismatch | Ensure overlay window label is "overlay" in `lib.rs` |
| Split times stuck at 0 | Using stale `timer.elapsedMs` | Must calculate `Date.now() - timer.startTime` |
| API 429 errors | Rate limit exceeded | Token bucket in `api_client.rs` should handle this; check for concurrent requests |
| SmartScreen warning | App not code-signed | Expected for unsigned apps; click "More info" > "Run anyway" |

### POE API Notes

- **Rate limit**: 5 req/sec, burst of 10
- **Caching**: 30-second response cache in `api_client.rs`
- **Auth**: Uses public API only (no POESESSID required)
- **Mastery effects**: Can be array or map format; custom deserializer handles both

## Rollback Procedure

Since this is a desktop app distributed via GitHub Releases:

1. **Users can manually rollback** by downloading a previous version from [Releases](https://github.com/kburke8/poe-watcher/releases)
2. **To prevent auto-update to a bad version**:
   - Delete or unpublish the broken GitHub Release
   - The `latest.json` will then point to the previous good release
3. **Database is forward-compatible**: SQLite migrations only add tables/columns, never remove. Downgrading the app binary should work with an existing database.

### Emergency: Pull a Release

```bash
# Delete the tag
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
```

Then delete the GitHub Release from the web UI. The auto-updater will stop offering the bad version.

## Monitoring

No server-side monitoring (fully client-side app). Users report issues via [GitHub Issues](https://github.com/kburke8/poe-watcher/issues).

### Diagnostic Information to Request

When triaging user issues, ask for:
- Windows version
- POE Watcher version (shown in Settings)
- POE version (Steam vs Standalone)
- Client.txt path
- Steps to reproduce
- Console errors (if accessible via DevTools: `Ctrl+Shift+I` in dev mode)

## CI/CD

### GitHub Actions Workflow

**File**: `.github/workflows/release.yml`
**Trigger**: Push tag matching `v*`
**Runner**: `windows-latest`
**Secrets required**:
- `GITHUB_TOKEN` (automatic)
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

### CI Caching

- **npm**: Cached via `actions/setup-node` with `cache: npm`
- **Rust**: Cached via `swatinem/rust-cache` (workspace: `src-tauri`)
