param(
    [ValidateSet("patch", "minor", "major")]
    [string]$BumpType = "patch",
    [switch]$SkipBump,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

# --- MSVC Environment ---
$vsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if (Test-Path $vsPath) {
    Write-Host "Setting up MSVC environment..." -ForegroundColor Cyan
    cmd /c "`"$vsPath`" && set" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
} else {
    Write-Host "WARNING: MSVC vcvars64.bat not found at $vsPath" -ForegroundColor Yellow
    Write-Host "Build may fail without MSVC in PATH." -ForegroundColor Yellow
}

$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"

# --- Version Bump ---
if (-not $SkipBump) {
    $tauriConf = Get-Content "src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json
    $currentVersion = $tauriConf.version
    $parts = $currentVersion.Split(".")
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2]

    switch ($BumpType) {
        "major" { $major++; $minor = 0; $patch = 0 }
        "minor" { $minor++; $patch = 0 }
        "patch" { $patch++ }
    }
    $newVersion = "$major.$minor.$patch"
    Write-Host "Bumping version: $currentVersion -> $newVersion" -ForegroundColor Green

    # Update tauri.conf.json
    $tauriRaw = Get-Content "src-tauri\tauri.conf.json" -Raw
    $tauriRaw = $tauriRaw -replace "`"version`":\s*`"$currentVersion`"", "`"version`": `"$newVersion`""
    Set-Content "src-tauri\tauri.conf.json" $tauriRaw -NoNewline

    # Update Cargo.toml
    $cargoRaw = Get-Content "src-tauri\Cargo.toml" -Raw
    $cargoRaw = $cargoRaw -replace "version\s*=\s*`"$currentVersion`"", "version = `"$newVersion`""
    Set-Content "src-tauri\Cargo.toml" $cargoRaw -NoNewline

    # Update package.json
    $pkgRaw = Get-Content "package.json" -Raw
    $pkgRaw = $pkgRaw -replace "`"version`":\s*`"$currentVersion`"", "`"version`": `"$newVersion`""
    Set-Content "package.json" $pkgRaw -NoNewline

    Write-Host "Version bumped to $newVersion in tauri.conf.json, Cargo.toml, and package.json" -ForegroundColor Green
} else {
    $tauriConf = Get-Content "src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json
    $newVersion = $tauriConf.version
    Write-Host "Skipping version bump (current: $newVersion)" -ForegroundColor Yellow
}

# --- Signing Key ---
$keyPath = "$env:USERPROFILE\.tauri\poe-watcher.key"
if (Test-Path $keyPath) {
    $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $keyPath -Raw
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "poe-watcher-sign"
    Write-Host "Signing key loaded from $keyPath" -ForegroundColor Green
} else {
    Write-Host "No signing key at $keyPath - updater artifacts will not be signed" -ForegroundColor Yellow
}

# --- Build ---
Write-Host "`nBuilding POE Watcher v$newVersion..." -ForegroundColor Cyan
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Build complete!" -ForegroundColor Green

# --- Install ---
if (-not $SkipInstall) {
    $installerDir = "src-tauri\target\release\bundle\nsis"
    $installer = Get-ChildItem "$installerDir\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($installer) {
        Write-Host "`nRunning installer: $($installer.Name)..." -ForegroundColor Cyan
        Start-Process -FilePath $installer.FullName -ArgumentList "/S" -Wait
        Write-Host "Installation complete!" -ForegroundColor Green
    } else {
        Write-Host "No NSIS installer found in $installerDir" -ForegroundColor Yellow
    }
} else {
    Write-Host "Skipping install" -ForegroundColor Yellow
}

Write-Host "`nDone! POE Watcher v$newVersion" -ForegroundColor Green
