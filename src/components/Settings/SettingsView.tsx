import { useState, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUpdateChecker } from '../../hooks/useUpdateChecker';

const BREAKPOINTS_STORAGE_KEY = 'poe-watcher-breakpoints';

export function SettingsView() {
  const {
    poeLogPath,
    accountName,
    testCharacterName,
    checkUpdates,
    overlayEnabled,
    overlayOpacity,
    soundEnabled,
    breakpoints,
    setLogPath,
    setAccountName,
    setTestCharacterName,
    setCheckUpdates,
    setOverlayEnabled,
    setOverlayOpacity,
    setSoundEnabled,
    toggleBreakpoint,
    toggleSnapshotCapture,
    moveBreakpoint,
    setAllBreakpoints,
    setActBreakpoints,
    applySpeedrunPreset,
    applyMinimalPreset,
    applyTownsOnlyPreset,
    resetBreakpoints,
  } = useSettingsStore();

  const { checking, available, version, error: updateError, checkForUpdate, downloadAndInstall, downloading, progress } = useUpdateChecker(false);

  // Filter state for breakpoints
  const [actFilter, setActFilter] = useState<number | 'all' | 'level'>('all');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [overlayOpen, setOverlayOpen] = useState(false);

  // Toggle overlay window
  const handleToggleOverlay = useCallback(async () => {
    try {
      const isOpen = await invoke<boolean>('toggle_overlay');
      setOverlayOpen(isOpen);
    } catch (error) {
      console.error('Failed to toggle overlay:', error);
    }
  }, []);

  // Breakpoints are loaded and auto-saved in App.tsx

  // Get unique acts from breakpoints
  const acts = useMemo(() => {
    const actSet = new Set<number>();
    breakpoints.forEach((bp) => {
      if (bp.trigger.act !== undefined) {
        actSet.add(bp.trigger.act);
      }
    });
    return Array.from(actSet).sort((a, b) => a - b);
  }, [breakpoints]);

  // Filtered breakpoints
  const filteredBreakpoints = useMemo(() => {
    if (actFilter === 'all') return breakpoints;
    if (actFilter === 'level') return breakpoints.filter((bp) => bp.trigger.type === 'level');
    return breakpoints.filter((bp) => bp.trigger.act === actFilter);
  }, [breakpoints, actFilter]);

  const handleBrowseLogPath = async () => {
    try {
      const result = await open({
        multiple: false,
        filters: [{
          name: 'Log Files',
          extensions: ['txt']
        }],
        title: 'Select Client.txt',
      });
      if (result) {
        setLogPath(result);
      }
    } catch (error) {
      console.error('Failed to browse for log path:', error);
    }
  };

  const handleDetectLogPath = async () => {
    try {
      const result = await invoke<string | null>('detect_log_path_cmd');
      if (result) {
        setLogPath(result);
      } else {
        alert('Could not auto-detect POE log path. Please browse manually.');
      }
    } catch (error) {
      console.error('Failed to detect log path:', error);
    }
  };

  const handleSaveSettings = async () => {
    setSaveStatus('saving');
    try {
      // Save core settings to backend
      await invoke('save_settings', {
        settings: {
          poe_log_path: poeLogPath,
          account_name: accountName,
          overlay_enabled: overlayEnabled,
          overlay_opacity: overlayOpacity,
          sound_enabled: soundEnabled,
        },
      });

      // Save breakpoints to localStorage (not stored in backend)
      // Deduplicate before saving
      try {
        const seen = new Set<string>();
        const deduplicated = breakpoints.filter((bp) => {
          if (seen.has(bp.name)) return false;
          seen.add(bp.name);
          return true;
        });
        localStorage.setItem(BREAKPOINTS_STORAGE_KEY, JSON.stringify(deduplicated));
        console.log('Saved breakpoints to localStorage:', deduplicated.length);
      } catch (e) {
        console.error('Failed to save breakpoints to localStorage:', e);
      }

      // Restart log watcher with new path
      if (poeLogPath) {
        try {
          await invoke('stop_log_watcher');
        } catch {
          // Ignore if not running
        }
        await invoke('start_log_watcher', { logPath: poeLogPath });
        console.log('Log watcher restarted for:', poeLogPath);
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-[--color-text] mb-6">Settings</h1>

        {/* POE Configuration */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[--color-text] mb-4">Path of Exile</h2>
          <div className="bg-[--color-surface] rounded-lg p-4 space-y-4">
            {/* Log path */}
            <div>
              <label className="block text-sm text-[--color-text-muted] mb-2">
                Client.txt Log Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={poeLogPath}
                  onChange={(e) => setLogPath(e.target.value)}
                  placeholder="C:\...\Path of Exile\logs\Client.txt"
                  className="flex-1 p-3 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] placeholder-[--color-text-muted]"
                />
                <button
                  onClick={handleBrowseLogPath}
                  className="px-4 py-2 bg-[--color-surface] text-[--color-text] rounded-lg border-2 border-[--color-poe-gold]/40 shadow-sm hover:border-[--color-poe-gold]/70 hover:shadow-md active:scale-95 active:shadow-none transition-all duration-100 font-medium"
                >
                  Browse
                </button>
                <button
                  onClick={handleDetectLogPath}
                  className="px-4 py-2 bg-[--color-poe-gold] text-[--color-poe-darker] rounded-lg border border-[--color-poe-gold-light] shadow-sm hover:bg-[--color-poe-gold-light] hover:shadow-md active:scale-95 active:shadow-none transition-all duration-100 font-semibold"
                >
                  Auto-detect
                </button>
              </div>
              <p className="text-xs text-[--color-text-muted] mt-2">
                The application monitors this file for game events.
              </p>
            </div>

            {/* Account name */}
            <div>
              <label className="block text-sm text-[--color-text-muted] mb-2">
                POE Account Name
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="YourAccountName"
                className="w-full p-3 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] placeholder-[--color-text-muted]"
              />
              <p className="text-xs text-[--color-text-muted] mt-2">
                Required for fetching character data from the POE API. Your profile must be set to public.
              </p>
            </div>

            {/* Test character name */}
            <div>
              <label className="block text-sm text-[--color-text-muted] mb-2">
                Test Character Name
              </label>
              <input
                type="text"
                value={testCharacterName}
                onChange={(e) => setTestCharacterName(e.target.value)}
                placeholder="beerdz_layoutguy"
                className="w-full p-3 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] placeholder-[--color-text-muted]"
              />
              <p className="text-xs text-[--color-text-muted] mt-2">
                Fallback character name for snapshots when not detected from game events.
              </p>
            </div>
          </div>
        </section>

        {/* Overlay Settings */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[--color-text] mb-4">Overlay</h2>
          <div className="bg-[--color-surface] rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[--color-text]">Enable Overlay</div>
                <div className="text-xs text-[--color-text-muted]">Show minimal timer as overlay window</div>
              </div>
              <button
                onClick={() => setOverlayEnabled(!overlayEnabled)}
                className={`w-12 h-6 rounded-full transition-all duration-150 active:scale-95 ${
                  overlayEnabled ? 'bg-[--color-poe-gold]' : 'bg-[--color-surface-elevated]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ${
                    overlayEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm text-[--color-text-muted] mb-2">
                Overlay Opacity: {Math.round(overlayOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[--color-border]">
              <div>
                <div className="text-[--color-text]">Test Overlay</div>
                <div className="text-xs text-[--color-text-muted]">Open overlay to test position (Ctrl+O)</div>
              </div>
              <button
                onClick={handleToggleOverlay}
                className={`px-4 py-2 text-sm rounded-md border-2 transition-all active:scale-95 font-medium ${
                  overlayOpen
                    ? 'bg-[--color-timer-behind] text-white border-red-400'
                    : 'bg-[--color-surface] text-[--color-text] border-[--color-poe-gold]/40 hover:border-[--color-poe-gold]/70'
                }`}
              >
                {overlayOpen ? 'Close Overlay' : 'Open Overlay'}
              </button>
            </div>
          </div>
        </section>

        {/* Sound Settings */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[--color-text] mb-4">Audio</h2>
          <div className="bg-[--color-surface] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[--color-text]">Enable Sounds</div>
                <div className="text-xs text-[--color-text-muted]">Play sounds on splits and events</div>
              </div>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-12 h-6 rounded-full transition-all duration-150 active:scale-95 ${
                  soundEnabled ? 'bg-[--color-poe-gold]' : 'bg-[--color-surface-elevated]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ${
                    soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Updates */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[--color-text] mb-4">Updates</h2>
          <div className="bg-[--color-surface] rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[--color-text]">Check for Updates Automatically</div>
                <div className="text-xs text-[--color-text-muted]">Check for new versions on startup</div>
              </div>
              <button
                onClick={() => setCheckUpdates(!checkUpdates)}
                className={`w-12 h-6 rounded-full transition-all duration-150 active:scale-95 ${
                  checkUpdates ? 'bg-[--color-poe-gold]' : 'bg-[--color-surface-elevated]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-150 ${
                    checkUpdates ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[--color-border]">
              <div>
                <div className="text-[--color-text]">Check Now</div>
                <div className="text-xs text-[--color-text-muted]">
                  {checking ? 'Checking...' :
                   available ? `v${version} available` :
                   updateError ? 'Check failed' :
                   'Check for updates manually'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {available && !downloading && (
                  <button
                    onClick={downloadAndInstall}
                    className="px-3 py-1.5 text-sm bg-[--color-poe-gold] text-[--color-poe-darker] rounded-md font-semibold hover:bg-[--color-poe-gold-light] active:scale-95 transition-all"
                  >
                    Update & Restart
                  </button>
                )}
                {downloading && (
                  <div className="w-24 bg-[--color-surface] rounded-full h-2">
                    <div
                      className="bg-[--color-poe-gold] h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
                <button
                  onClick={checkForUpdate}
                  disabled={checking || downloading}
                  className="px-4 py-2 text-sm bg-[--color-surface] text-[--color-text] rounded-md border-2 border-[--color-poe-gold]/40 shadow-sm hover:border-[--color-poe-gold]/70 hover:shadow-md active:scale-95 active:shadow-none transition-all font-medium disabled:opacity-50 disabled:cursor-wait"
                >
                  {checking ? 'Checking...' : 'Check Now'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Breakpoints */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[--color-text] mb-4">Breakpoints</h2>
          <div className="bg-[--color-surface] rounded-lg overflow-hidden">
            {/* Filter and bulk actions */}
            <div className="p-4 border-b border-[--color-border] space-y-3">
              <p className="text-sm text-[--color-text-muted]">
                Toggle which breakpoints trigger automatic splits. Breakpoints are matched sequentially - only the next expected split will trigger.
              </p>

              {/* Preset row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[--color-text-muted]">Presets:</span>
                <button
                  onClick={applySpeedrunPreset}
                  className="px-4 py-2 text-sm bg-[--color-poe-gold] text-[--color-poe-darker] rounded-md border border-[--color-poe-gold-light] shadow-sm hover:bg-[--color-poe-gold-light] hover:shadow-md active:scale-95 active:shadow-none transition-all font-semibold"
                >
                  Speedrun (Default)
                </button>
                <button
                  onClick={applyMinimalPreset}
                  className="px-4 py-2 text-sm bg-[--color-surface] text-[--color-text] rounded-md border-2 border-[--color-poe-gold]/40 shadow-sm hover:border-[--color-poe-gold]/70 hover:shadow-md active:scale-95 active:shadow-none transition-all font-medium"
                >
                  Minimal
                </button>
                <button
                  onClick={applyTownsOnlyPreset}
                  className="px-4 py-2 text-sm bg-[--color-surface] text-[--color-text] rounded-md border-2 border-[--color-poe-gold]/40 shadow-sm hover:border-[--color-poe-gold]/70 hover:shadow-md active:scale-95 active:shadow-none transition-all font-medium"
                >
                  Towns Only
                </button>
                <button
                  onClick={resetBreakpoints}
                  className="px-4 py-2 text-sm bg-[--color-surface] text-[--color-text] rounded-md border-2 border-[--color-poe-gold]/40 shadow-sm hover:border-[--color-poe-gold]/70 hover:shadow-md active:scale-95 active:shadow-none transition-all font-medium"
                >
                  Reset
                </button>
              </div>

              {/* Filter row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[--color-text-muted]">Filter:</span>
                <button
                  onClick={() => setActFilter('all')}
                  className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all active:scale-95 font-medium ${
                    actFilter === 'all'
                      ? 'bg-[--color-poe-gold] text-[--color-poe-darker] border-[--color-poe-gold-light] shadow-sm'
                      : 'bg-[--color-surface] text-[--color-text] border-[--color-poe-gold]/30 hover:border-[--color-poe-gold]/60'
                  }`}
                >
                  All
                </button>
                {acts.map((act) => (
                  <button
                    key={act}
                    onClick={() => setActFilter(act)}
                    className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all active:scale-95 font-medium ${
                      actFilter === act
                        ? 'bg-[--color-poe-gold] text-[--color-poe-darker] border-[--color-poe-gold-light] shadow-sm'
                        : 'bg-[--color-surface] text-[--color-text] border-[--color-poe-gold]/30 hover:border-[--color-poe-gold]/60'
                    }`}
                  >
                    Act {act}
                  </button>
                ))}
                <button
                  onClick={() => setActFilter('level')}
                  className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all active:scale-95 font-medium ${
                    actFilter === 'level'
                      ? 'bg-[--color-poe-gold] text-[--color-poe-darker] border-[--color-poe-gold-light] shadow-sm'
                      : 'bg-[--color-surface] text-[--color-text] border-[--color-poe-gold]/30 hover:border-[--color-poe-gold]/60'
                  }`}
                >
                  Levels
                </button>
              </div>

              {/* Bulk action row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[--color-text-muted]">Quick:</span>
                <button
                  onClick={() => setAllBreakpoints(true)}
                  className="px-3 py-1.5 text-sm bg-[--color-timer-ahead] text-white rounded-md border border-green-400 shadow-sm hover:brightness-110 hover:shadow-md active:scale-95 active:shadow-none transition-all font-medium"
                >
                  Enable All
                </button>
                <button
                  onClick={() => setAllBreakpoints(false)}
                  className="px-3 py-1.5 text-sm bg-[--color-timer-behind] text-white rounded-md border border-red-400 shadow-sm hover:brightness-110 hover:shadow-md active:scale-95 active:shadow-none transition-all font-medium"
                >
                  Disable All
                </button>
                {actFilter !== 'all' && actFilter !== 'level' && (
                  <>
                    <span className="text-[--color-text-muted]">|</span>
                    <button
                      onClick={() => setActBreakpoints(actFilter, true)}
                      className="px-3 py-1.5 text-sm bg-[--color-surface] text-[--color-text] rounded-md border-2 border-[--color-poe-gold]/40 shadow-sm hover:border-[--color-poe-gold]/70 hover:shadow-md active:scale-95 active:shadow-none transition-all font-medium"
                    >
                      Enable Act {actFilter}
                    </button>
                    <button
                      onClick={() => setActBreakpoints(actFilter, false)}
                      className="px-3 py-1.5 text-sm bg-[--color-surface] text-[--color-text] rounded-md border-2 border-[--color-poe-gold]/40 shadow-sm hover:border-[--color-poe-gold]/70 hover:shadow-md active:scale-95 active:shadow-none transition-all font-medium"
                    >
                      Disable Act {actFilter}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Breakpoint list */}
            <div className="max-h-96 overflow-auto">
              {filteredBreakpoints.length === 0 ? (
                <div className="p-4 text-center text-[--color-text-muted]">
                  No breakpoints match the current filter.
                </div>
              ) : (
                filteredBreakpoints.map((bp, index) => (
                  <div
                    key={`${index}-${bp.name}`}
                    className="flex items-center justify-between p-3 border-b border-[--color-border] last:border-0 hover:bg-[--color-surface-elevated]/50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-sm flex-shrink-0">{getTypeIcon(bp.type)}</span>
                      <span className={`truncate ${bp.isEnabled ? 'text-[--color-text]' : 'text-[--color-text-muted]'}`}>{bp.name}</span>
                      <span className="text-xs text-[--color-text-muted] bg-[--color-surface-elevated] px-2 py-0.5 rounded flex-shrink-0">
                        {bp.type}
                      </span>
                      {bp.trigger.act && (
                        <span className="text-xs text-[--color-text-muted] flex-shrink-0">
                          A{bp.trigger.act}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Move buttons */}
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveBreakpoint(bp.name, 'up')}
                          disabled={index === 0}
                          className="p-1 text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveBreakpoint(bp.name, 'down')}
                          disabled={index === filteredBreakpoints.length - 1}
                          className="p-1 text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      {/* Snapshot toggle */}
                      <button
                        onClick={() => toggleSnapshotCapture(bp.name)}
                        disabled={!bp.isEnabled}
                        className={`p-1.5 rounded transition-all active:scale-90 ${
                          bp.captureSnapshot && bp.isEnabled
                            ? 'text-amber-400 bg-amber-400/20 border border-amber-400/50'
                            : bp.isEnabled
                            ? 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-600'
                            : 'text-zinc-600 border border-transparent opacity-30 cursor-not-allowed'
                        }`}
                        title={bp.captureSnapshot ? 'Snapshot enabled - click to disable' : 'Click to enable snapshot capture'}
                      >
                        <svg className="w-4 h-4" fill={bp.captureSnapshot && bp.isEnabled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                      {/* Split toggle */}
                      <button
                        onClick={() => toggleBreakpoint(bp.name)}
                        className={`w-10 h-5 rounded-full transition-all duration-150 active:scale-95 border ${
                          bp.isEnabled
                            ? 'bg-green-600 border-green-500'
                            : 'bg-zinc-700 border-zinc-600'
                        }`}
                        title={bp.isEnabled ? 'Split enabled' : 'Enable split'}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-150 ${
                            bp.isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Count info */}
            <div className="p-3 border-t border-[--color-border] text-xs text-[--color-text-muted]">
              {filteredBreakpoints.filter((bp) => bp.isEnabled).length} of {filteredBreakpoints.length} enabled
              {actFilter !== 'all' && ` (filtered from ${breakpoints.length} total)`}
            </div>
          </div>
        </section>

        {/* Save button */}
        <div className="flex gap-3 items-center">
          <button
            onClick={handleSaveSettings}
            disabled={saveStatus === 'saving'}
            className={`px-6 py-3 font-semibold rounded-lg border shadow-md transition-all duration-100 ${
              saveStatus === 'saving'
                ? 'bg-[--color-surface-elevated] text-[--color-text-muted] border-[--color-border] cursor-wait shadow-none'
                : saveStatus === 'saved'
                ? 'bg-[--color-timer-ahead] text-white border-green-400'
                : saveStatus === 'error'
                ? 'bg-[--color-timer-behind] text-white border-red-400'
                : 'bg-[--color-poe-gold] text-[--color-poe-darker] border-[--color-poe-gold-light] hover:bg-[--color-poe-gold-light] hover:shadow-lg active:scale-95 active:shadow-sm'
            }`}
          >
            {saveStatus === 'saving' ? 'Saving...' :
             saveStatus === 'saved' ? 'Saved!' :
             saveStatus === 'error' ? 'Error!' :
             'Save Settings'}
          </button>
          {saveStatus === 'error' && (
            <span className="text-[--color-timer-behind] text-sm">Check console for details</span>
          )}
        </div>
      </div>
    </div>
  );
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'zone': return '📍';
    case 'level': return '⬆';
    case 'boss': return '💀';
    case 'act': return '🏛';
    case 'lab': return '🏆';
    case 'custom': return '⭐';
    default: return '•';
  }
}
