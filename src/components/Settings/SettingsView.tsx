import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { MapPin, ArrowUp, Skull, Landmark, Trophy, Star, ChevronUp, ChevronDown, Save } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUpdateChecker } from '../../hooks/useUpdateChecker';
import { BreakpointWizard } from './BreakpointWizard';
import { HotkeyInput } from './HotkeyInput';
import { Button } from '../Shared/Button';
import { Toggle } from '../Shared/Toggle';
import { HelpTip } from '../Shared/HelpTip';
import { LoadingSpinner } from '../Shared/LoadingSpinner';
import type { HotkeySettings, BreakpointType, Breakpoint } from '../../types';
import { DEFAULT_HOTKEYS } from '../../types';

const BREAKPOINTS_STORAGE_KEY = 'poe-watcher-breakpoints';

const HOTKEY_ACTIONS: { key: keyof HotkeySettings; label: string }[] = [
  { key: 'toggleTimer', label: 'Start / Pause Timer' },
  { key: 'resetTimer', label: 'Reset Timer' },
  { key: 'manualSplit', label: 'Manual Split' },
  { key: 'manualSnapshot', label: 'Manual Snapshot' },
  { key: 'toggleOverlay', label: 'Toggle Overlay' },
];

type SettingsTab = 'general' | 'breakpoints' | 'overlay' | 'shortcuts';

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'breakpoints', label: 'Breakpoints' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'shortcuts', label: 'Shortcuts' },
];

function getTypeIcon(type: BreakpointType | string): ReactNode {
  const cls = 'w-4 h-4';
  const sw = 1.75;
  switch (type) {
    case 'zone': return <MapPin className={cls} strokeWidth={sw} />;
    case 'level': return <ArrowUp className={cls} strokeWidth={sw} />;
    case 'boss': return <Skull className={cls} strokeWidth={sw} />;
    case 'act': return <Landmark className={cls} strokeWidth={sw} />;
    case 'lab': return <Trophy className={cls} strokeWidth={sw} />;
    case 'custom': return <Star className={cls} strokeWidth={sw} />;
    default: return <span>•</span>;
  }
}

export function SettingsView() {
  const {
    poeLogPath,
    accountName,
    testCharacterName,
    checkUpdates,
    overlayEnabled,
    overlayOpacity,
    breakpoints,
    setLogPath,
    setAccountName,
    setTestCharacterName,
    setCheckUpdates,
    setOverlayEnabled,
    setOverlayOpacity,
    toggleBreakpoint,
    toggleSnapshotCapture,
    moveBreakpoint,
    setAllBreakpoints,
    setActBreakpoints,
    // Overlay config
    overlayScale,
    overlayFontSize,
    overlayShowTimer,
    overlayShowZone,
    overlayShowLastSplit,
    overlayShowBreakpoints,
    overlayBreakpointCount,
    overlayBgOpacity,
    overlayAccentColor,
    overlayAlwaysOnTop,
    overlayOpen,
    setOverlayScale,
    setOverlayShowTimer,
    setOverlayShowZone,
    setOverlayShowLastSplit,
    setOverlayShowBreakpoints,
    setOverlayBgOpacity,
    setOverlayAccentColor,
    setOverlayAlwaysOnTop,
    setOverlayOpen,
    // Endgame mode
    endgameEnabled,
    setEndgameEnabled,
    // Hotkeys
    hotkeys,
    setHotkeys,
    // Navigation
    pendingSettingsTab,
    clearPendingSettingsTab,
  } = useSettingsStore();
  const { checking, available, version, error: updateError, checkForUpdate, downloadAndInstall, downloading, progress } = useUpdateChecker(false);

  // Tab state - use pending tab from store if set
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    (pendingSettingsTab as SettingsTab) || 'general'
  );

  // Clear pending tab after consuming it
  useEffect(() => {
    if (pendingSettingsTab) {
      setActiveTab(pendingSettingsTab as SettingsTab);
      clearPendingSettingsTab();
    }
  }, [pendingSettingsTab, clearPendingSettingsTab]);

  // Filter state for breakpoints
  const [actFilter, setActFilter] = useState<number | 'all' | 'level'>('all');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Local hotkey editing state (changes are applied on "Apply" click)
  const [editingHotkeys, setEditingHotkeys] = useState<HotkeySettings>({ ...hotkeys });
  const [hotkeyErrors, setHotkeyErrors] = useState<Partial<Record<keyof HotkeySettings, string>>>({});
  const [hotkeyApplyStatus, setHotkeyApplyStatus] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle');

  // Sync local editing state when store hotkeys change (e.g., after loadHotkeys)
  const [lastSyncedHotkeys, setLastSyncedHotkeys] = useState(hotkeys);
  if (hotkeys !== lastSyncedHotkeys) {
    setEditingHotkeys({ ...hotkeys });
    setLastSyncedHotkeys(hotkeys);
  }

  const handleHotkeyChange = useCallback((key: keyof HotkeySettings, value: string) => {
    setEditingHotkeys(prev => ({ ...prev, [key]: value }));

    // Check for duplicates
    setHotkeyErrors(() => {
      const newErrors: Partial<Record<keyof HotkeySettings, string>> = {};
      const allKeys = HOTKEY_ACTIONS.map(a => a.key);
      const values = { ...editingHotkeys, [key]: value } as Record<keyof HotkeySettings, string>;

      for (const k of allKeys) {
        const v = values[k];
        const duplicateKey = allKeys.find(other => other !== k && values[other] === v);
        if (duplicateKey) {
          const duplicateLabel = HOTKEY_ACTIONS.find(a => a.key === duplicateKey)?.label || duplicateKey;
          newErrors[k] = `Conflicts with "${duplicateLabel}"`;
        }
      }
      return newErrors;
    });
    setHotkeyApplyStatus('idle');
  }, [editingHotkeys]);

  const hasHotkeyChanges = useMemo(() => {
    return Object.keys(editingHotkeys).some(
      k => editingHotkeys[k as keyof HotkeySettings] !== hotkeys[k as keyof HotkeySettings]
    );
  }, [editingHotkeys, hotkeys]);

  const hasHotkeyErrors = Object.keys(hotkeyErrors).length > 0;

  const handleApplyHotkeys = useCallback(async () => {
    if (hasHotkeyErrors) return;
    setHotkeyApplyStatus('applying');
    try {
      await invoke('update_hotkeys', { hotkeys: editingHotkeys });
      setHotkeys(editingHotkeys);
      setHotkeyApplyStatus('applied');
      setTimeout(() => setHotkeyApplyStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to apply hotkeys:', error);
      setHotkeyApplyStatus('error');
      setTimeout(() => setHotkeyApplyStatus('idle'), 3000);
    }
  }, [editingHotkeys, hasHotkeyErrors, setHotkeys]);

  const handleResetHotkeys = useCallback(async () => {
    setHotkeyApplyStatus('applying');
    try {
      await invoke('update_hotkeys', { hotkeys: DEFAULT_HOTKEYS });
      setHotkeys({ ...DEFAULT_HOTKEYS });
      setEditingHotkeys({ ...DEFAULT_HOTKEYS });
      setHotkeyErrors({});
      setHotkeyApplyStatus('applied');
      setTimeout(() => setHotkeyApplyStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to reset hotkeys:', error);
      setHotkeyApplyStatus('error');
      setTimeout(() => setHotkeyApplyStatus('idle'), 3000);
    }
  }, [setHotkeys]);

  // Toggle overlay window
  const handleToggleOverlay = useCallback(async () => {
    try {
      const isOpen = await invoke<boolean>('toggle_overlay');
      setOverlayOpen(isOpen);
    } catch (error) {
      console.error('Failed to toggle overlay:', error);
    }
  }, [setOverlayOpen]);

  // Reset overlay position
  const handleResetPosition = useCallback(async () => {
    try {
      await invoke('reset_overlay_position');
    } catch (error) {
      console.error('Failed to reset overlay position:', error);
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
        alert('Could not auto-detect PoE log path. Please browse manually.');
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
          sound_enabled: true,
          overlay_scale: overlayScale,
          overlay_font_size: overlayFontSize,
          overlay_show_timer: overlayShowTimer,
          overlay_show_zone: overlayShowZone,
          overlay_show_last_split: overlayShowLastSplit,
          overlay_show_breakpoints: overlayShowBreakpoints,
          overlay_breakpoint_count: overlayBreakpointCount,
          overlay_bg_opacity: overlayBgOpacity,
          overlay_accent_color: overlayAccentColor,
          overlay_always_on_top: overlayAlwaysOnTop,
          hotkey_toggle_timer: hotkeys.toggleTimer,
          hotkey_reset_timer: hotkeys.resetTimer,
          hotkey_manual_snapshot: hotkeys.manualSnapshot,
          hotkey_toggle_overlay: hotkeys.toggleOverlay,
          hotkey_manual_split: hotkeys.manualSplit,
          group_mode_enabled: useSettingsStore.getState().groupModeEnabled,
          show_town_visits: useSettingsStore.getState().showTownVisits,
          minimize_to_tray: useSettingsStore.getState().minimizeToTray,
          endgame_enabled: useSettingsStore.getState().endgameEnabled,
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
      }

      // Sync minimize-to-tray runtime flag
      await invoke('set_minimize_to_tray', { enabled: useSettingsStore.getState().minimizeToTray });

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
        <h1 className="text-2xl font-bold text-[--color-text] mb-6 flex items-center gap-2">
          Settings
          <HelpTip>
            Configure your PoE log file path, account name, breakpoints, overlay, hotkeys, and other preferences. Changes to General settings require clicking Save.
          </HelpTip>
        </h1>

        {/* Tab bar */}
        <div className="flex gap-6 border-b border-[--color-border] mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 px-1 text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-[--color-text] border-[--color-poe-gold] font-medium'
                  : 'text-[--color-text-muted] border-transparent hover:text-[--color-text] hover:border-[--color-poe-gold]/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'general' && <GeneralTab
          poeLogPath={poeLogPath}
          accountName={accountName}
          testCharacterName={testCharacterName}
          checkUpdates={checkUpdates}
          setLogPath={setLogPath}
          setAccountName={setAccountName}
          setTestCharacterName={setTestCharacterName}
          setCheckUpdates={setCheckUpdates}
          handleBrowseLogPath={handleBrowseLogPath}
          handleDetectLogPath={handleDetectLogPath}
          handleSaveSettings={handleSaveSettings}
          saveStatus={saveStatus}
          checking={checking}
          available={available}
          version={version}
          updateError={updateError}
          checkForUpdate={checkForUpdate}
          downloadAndInstall={downloadAndInstall}
          downloading={downloading}
          progress={progress}
        />}

        {activeTab === 'breakpoints' && <BreakpointsTab
          breakpoints={breakpoints}
          filteredBreakpoints={filteredBreakpoints}
          acts={acts}
          actFilter={actFilter}
          setActFilter={setActFilter}
          toggleBreakpoint={toggleBreakpoint}
          toggleSnapshotCapture={toggleSnapshotCapture}
          moveBreakpoint={moveBreakpoint}
          setAllBreakpoints={setAllBreakpoints}
          setActBreakpoints={setActBreakpoints}
        />}

        {activeTab === 'overlay' && <OverlayTab
          overlayEnabled={overlayEnabled}
          overlayOpacity={overlayOpacity}
          overlayScale={overlayScale}
          overlayBgOpacity={overlayBgOpacity}
          overlayAccentColor={overlayAccentColor}
          overlayShowTimer={overlayShowTimer}
          overlayShowZone={overlayShowZone}
          overlayShowLastSplit={overlayShowLastSplit}
          overlayShowBreakpoints={overlayShowBreakpoints}
          overlayAlwaysOnTop={overlayAlwaysOnTop}
          overlayOpen={overlayOpen}
          endgameEnabled={endgameEnabled}
          setOverlayEnabled={setOverlayEnabled}
          setOverlayOpacity={setOverlayOpacity}
          setOverlayScale={setOverlayScale}
          setOverlayBgOpacity={setOverlayBgOpacity}
          setOverlayAccentColor={setOverlayAccentColor}
          setOverlayShowTimer={setOverlayShowTimer}
          setOverlayShowZone={setOverlayShowZone}
          setOverlayShowLastSplit={setOverlayShowLastSplit}
          setOverlayShowBreakpoints={setOverlayShowBreakpoints}
          setOverlayAlwaysOnTop={setOverlayAlwaysOnTop}
          setEndgameEnabled={setEndgameEnabled}
          handleToggleOverlay={handleToggleOverlay}
          handleResetPosition={handleResetPosition}
          hotkeys={hotkeys}
        />}

        {activeTab === 'shortcuts' && <ShortcutsTab
          editingHotkeys={editingHotkeys}
          hotkeyErrors={hotkeyErrors}
          hotkeyApplyStatus={hotkeyApplyStatus}
          hasHotkeyChanges={hasHotkeyChanges}
          hasHotkeyErrors={hasHotkeyErrors}
          handleHotkeyChange={handleHotkeyChange}
          handleApplyHotkeys={handleApplyHotkeys}
          handleResetHotkeys={handleResetHotkeys}
        />}
      </div>
    </div>
  );
}

/* ---------- Group Mode Section ---------- */

function GroupModeSection() {
  const groupModeEnabled = useSettingsStore((s) => s.groupModeEnabled);
  const setGroupModeEnabled = useSettingsStore((s) => s.setGroupModeEnabled);

  return (
    <section>
      <h2 className="text-lg font-semibold text-[--color-text] mb-4 flex items-center gap-2 flex-wrap">
        Group Mode
        <HelpTip>
          Group Mode tracks up to 5 party members during group speedruns. Each member's progress is tracked independently. Enable this before starting a group run, then configure members in the Group tab.
        </HelpTip>
      </h2>
      <div className="card-inset rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[--color-text]">Enable Group Mode</div>
            <div className="text-xs text-[--color-text-muted]">Track up to 5 party members during group speedruns. Configure members in the Group tab.</div>
          </div>
          <Toggle checked={groupModeEnabled} onChange={setGroupModeEnabled} />
        </div>
      </div>
    </section>
  );
}

/* ---------- System Tray Section ---------- */

function MinimizeToTraySection() {
  const minimizeToTray = useSettingsStore((s) => s.minimizeToTray);
  const setMinimizeToTray = useSettingsStore((s) => s.setMinimizeToTray);

  const handleToggle = useCallback(async (enabled: boolean) => {
    setMinimizeToTray(enabled);
    // Sync to Rust immediately so close behavior takes effect without needing Save
    try {
      await invoke('set_minimize_to_tray', { enabled });
    } catch (e) {
      console.error('[Settings] Failed to sync minimize-to-tray flag:', e);
    }
  }, [setMinimizeToTray]);

  return (
    <section>
      <h2 className="text-lg font-semibold text-[--color-text] mb-4 flex items-center gap-2 flex-wrap">
        System Tray
        <HelpTip>
          When enabled, closing the main window hides the app to the system tray instead of quitting. The overlay stays visible for in-game use. Restore the window by clicking the tray icon or using the "Show" menu. Use "Quit" in the tray menu to fully exit.
        </HelpTip>
      </h2>
      <div className="card-inset rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[--color-text]">Minimize to Tray on Close</div>
            <div className="text-xs text-[--color-text-muted]">Hide to system tray instead of quitting when you close the window.</div>
          </div>
          <Toggle checked={minimizeToTray} onChange={handleToggle} />
        </div>
      </div>
    </section>
  );
}

/* ---------- General Tab ---------- */

interface GeneralTabProps {
  poeLogPath: string;
  accountName: string;
  testCharacterName: string;
  checkUpdates: boolean;
  setLogPath: (v: string) => void;
  setAccountName: (v: string) => void;
  setTestCharacterName: (v: string) => void;
  setCheckUpdates: (v: boolean) => void;
  handleBrowseLogPath: () => void;
  handleDetectLogPath: () => void;
  handleSaveSettings: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  checking: boolean;
  available: boolean;
  version: string | null;
  updateError: string | null;
  checkForUpdate: () => void;
  downloadAndInstall: () => void;
  downloading: boolean;
  progress: number;
}

function GeneralTab({
  poeLogPath,
  accountName,
  testCharacterName,
  checkUpdates,
  setLogPath,
  setAccountName,
  setTestCharacterName,
  setCheckUpdates,
  handleBrowseLogPath,
  handleDetectLogPath,
  handleSaveSettings,
  saveStatus,
  checking,
  available,
  version,
  updateError,
  checkForUpdate,
  downloadAndInstall,
  downloading,
  progress,
}: GeneralTabProps) {
  return (
    <div className="space-y-8">
      {/* PoE Configuration */}
      <section>
        <h2 className="text-lg font-semibold text-[--color-text] mb-4 flex items-center gap-2 flex-wrap">
          Path of Exile
          <HelpTip>
            PoE Watcher monitors your Client.txt log file to detect zone changes, level ups, and other game events. Your account name is used to fetch character data (equipment, passives, skills) from the public PoE API. Your profile must be set to public at pathofexile.com for snapshots to work.
          </HelpTip>
        </h2>
        <div className="card-inset rounded-lg p-4 space-y-4">
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
              <Button variant="secondary" onClick={handleBrowseLogPath}>
                Browse
              </Button>
              <Button variant="primary" onClick={handleDetectLogPath}>
                Auto-detect
              </Button>
            </div>
            <p className="text-xs text-[--color-text-muted] mt-2">
              The application monitors this file for game events.
            </p>
          </div>

          {/* Account name */}
          <div>
            <label className="block text-sm text-[--color-text-muted] mb-2">
              PoE Account Name
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="YourName#1234"
              className="w-full p-3 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] placeholder-[--color-text-muted]"
            />
            <p className="text-xs text-[--color-text-muted] mt-2">
              Required for fetching character data from the PoE API. Your profile must be set to public. Example: <span className="font-mono text-[--color-text]">ExileRunner#1234</span>
            </p>
          </div>

          {/* Test character name - dev only */}
          {import.meta.env.DEV && (
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
          )}
        </div>
      </section>

      {/* Group Mode */}
      <GroupModeSection />

      {/* System Tray */}
      <MinimizeToTraySection />

      {/* Updates */}
      <section>
        <h2 className="text-lg font-semibold text-[--color-text] mb-4 flex items-center gap-2 flex-wrap">
          Updates
          <HelpTip>
            When enabled, PoE Watcher checks for new versions on startup. You can also check manually at any time. Updates are downloaded and installed automatically — the app will restart after updating.
          </HelpTip>
        </h2>
        <div className="card-inset rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[--color-text]">Check for Updates Automatically</div>
              <div className="text-xs text-[--color-text-muted]">Check for new versions on startup</div>
            </div>
            <Toggle checked={checkUpdates} onChange={setCheckUpdates} />
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
                <Button variant="primary" size="sm" onClick={downloadAndInstall}>
                  Update & Restart
                </Button>
              )}
              {downloading && (
                <div className="w-24 bg-[--color-surface] rounded-full h-2">
                  <div
                    className="bg-[--color-poe-gold] h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              <Button
                variant="secondary"
                onClick={checkForUpdate}
                disabled={checking || downloading}
              >
                {checking ? 'Checking...' : 'Check Now'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Save button */}
      <div className="flex gap-3 items-center">
        <Button
          variant={
            saveStatus === 'saved' ? 'primary' :
            saveStatus === 'error' ? 'destructive' :
            'primary'
          }
          size="lg"
          icon={saveStatus === 'idle' ? Save : undefined}
          loading={saveStatus === 'saving'}
          onClick={handleSaveSettings}
          disabled={saveStatus === 'saving'}
          className={
            saveStatus === 'saved'
              ? 'bg-[--color-timer-ahead] text-white border-green-400 hover:bg-[--color-timer-ahead]'
              : ''
          }
        >
          {saveStatus === 'saving' ? (
            <>
              <LoadingSpinner size="sm" />
              Saving...
            </>
          ) :
           saveStatus === 'saved' ? 'Saved!' :
           saveStatus === 'error' ? 'Error!' :
           'Save Settings'}
        </Button>
        {saveStatus === 'error' && (
          <span className="text-[--color-timer-behind] text-sm">Check console for details</span>
        )}
      </div>
    </div>
  );
}

/* ---------- Breakpoints Tab ---------- */

interface BreakpointsTabProps {
  breakpoints: Breakpoint[];
  filteredBreakpoints: Breakpoint[];
  acts: number[];
  actFilter: number | 'all' | 'level';
  setActFilter: (v: number | 'all' | 'level') => void;
  toggleBreakpoint: (name: string) => void;
  toggleSnapshotCapture: (name: string) => void;
  moveBreakpoint: (name: string, direction: 'up' | 'down') => void;
  setAllBreakpoints: (enabled: boolean) => void;
  setActBreakpoints: (act: number, enabled: boolean) => void;
}

function BreakpointsTab({
  breakpoints,
  filteredBreakpoints,
  acts,
  actFilter,
  setActFilter,
  toggleBreakpoint,
  toggleSnapshotCapture,
  moveBreakpoint,
  setAllBreakpoints,
  setActBreakpoints,
}: BreakpointsTabProps) {
  return (
    <div className="space-y-8">
      {/* Wizard */}
      <section>
        <h2 className="text-lg font-semibold text-[--color-text] mb-2 flex items-center gap-2 flex-wrap">
          Breakpoint Wizard
          <HelpTip>
            Breakpoints are zone transitions or events that trigger automatic splits in your timer. The wizard generates a set of breakpoints based on your run type (e.g., Act 10 Any%) and how many splits you want. You can choose bosses only, key zones, or every zone transition. The camera icon next to each breakpoint controls whether a character snapshot is captured at that split.
          </HelpTip>
        </h2>
        <p className="text-sm text-[--color-text-muted] mb-4">
          Configure which zone transitions trigger automatic splits. Use the wizard to generate a breakpoint set based on your run type and routing preferences.
        </p>
        <BreakpointWizard />
      </section>

      {/* Route Customizations - hidden for now */}
      {/* <section>
        <h2 className="text-lg font-semibold text-[--color-text] mb-2 flex items-center gap-2 flex-wrap">
          Route Customizations
          <span className="text-xs font-normal text-[--color-text-muted]">(Optional)</span>
          <HelpTip>
            Different speedrun routes take different paths through each act. These settings let you adjust zone ordering to match your preferred routing — for example, doing Dweller of the Deep before Brutus, or choosing Kaom before Daresso in Act 4.
          </HelpTip>
        </h2>
        <div className="card-inset rounded-lg p-4">
          <p className="text-sm text-[--color-text-muted] mb-4">
            Adjust zone ordering to match your preferred routing. Changes apply immediately to the wizard breakpoints.
          </p>
          <RouteCustomizations />
        </div>
      </section> */}

      {/* Manual Overrides */}
      <details className="group">
        <summary className="text-lg font-semibold text-[--color-text] mb-2 cursor-pointer list-none flex items-center gap-2 flex-wrap select-none hover:text-[--color-poe-gold] transition-colors">
          <svg className="w-4 h-4 text-[--color-text-muted] transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced: Manual Overrides
          <HelpTip>
            Override individual breakpoints generated by the wizard. You can enable/disable specific splits, toggle snapshot capture per breakpoint, and reorder them. Changes here persist even when the wizard regenerates breakpoints.
          </HelpTip>
        </summary>
        <div className="card-inset rounded-lg overflow-hidden">
          {/* Filter and bulk actions */}
          <div className="p-4 border-b border-[--color-border] space-y-3">
            <p className="text-sm text-[--color-text-muted]">
              Fine-tune individual breakpoints. Changes here override the wizard output.
            </p>

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
              <Button
                variant="primary"
                size="sm"
                onClick={() => setAllBreakpoints(true)}
                className="bg-[--color-timer-ahead] text-white border-green-400 hover:brightness-110 hover:bg-[--color-timer-ahead]"
              >
                Enable All
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setAllBreakpoints(false)}
              >
                Disable All
              </Button>
              {actFilter !== 'all' && actFilter !== 'level' && (
                <>
                  <span className="text-[--color-text-muted]">|</span>
                  <Button variant="secondary" size="sm" onClick={() => setActBreakpoints(actFilter, true)}>
                    Enable Act {actFilter}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setActBreakpoints(actFilter, false)}>
                    Disable Act {actFilter}
                  </Button>
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
                    <span className="text-sm flex-shrink-0 flex items-center justify-center text-[--color-text-muted]">
                      {getTypeIcon(bp.type)}
                    </span>
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
                        <ChevronUp className="w-4 h-4" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => moveBreakpoint(bp.name, 'down')}
                        disabled={index === filteredBreakpoints.length - 1}
                        className="p-1 text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" strokeWidth={2} />
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
                          ? 'text-[--color-text-muted] hover:text-[--color-text] border border-transparent hover:border-[--color-border]'
                          : 'text-[--color-text-muted] border border-transparent opacity-30 cursor-not-allowed'
                      }`}
                      title={bp.captureSnapshot ? 'Snapshot enabled - click to disable' : 'Click to enable snapshot capture'}
                    >
                      <svg className="w-4 h-4" fill={bp.captureSnapshot && bp.isEnabled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    {/* Split toggle */}
                    <Toggle
                      checked={bp.isEnabled}
                      onChange={() => toggleBreakpoint(bp.name)}
                      size="sm"
                    />
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
      </details>
    </div>
  );
}

/* ---------- Overlay Tab ---------- */

interface OverlayTabProps {
  overlayEnabled: boolean;
  overlayOpacity: number;
  overlayScale: 'small' | 'medium' | 'large';
  overlayBgOpacity: number;
  overlayAccentColor: string;
  overlayShowTimer: boolean;
  overlayShowZone: boolean;
  overlayShowLastSplit: boolean;
  overlayShowBreakpoints: boolean;
  overlayAlwaysOnTop: boolean;
  overlayOpen: boolean;
  endgameEnabled: boolean;
  setOverlayEnabled: (v: boolean) => void;
  setOverlayOpacity: (v: number) => void;
  setOverlayScale: (v: 'small' | 'medium' | 'large') => void;
  setOverlayBgOpacity: (v: number) => void;
  setOverlayAccentColor: (v: string) => void;
  setOverlayShowTimer: (v: boolean) => void;
  setOverlayShowZone: (v: boolean) => void;
  setOverlayShowLastSplit: (v: boolean) => void;
  setOverlayShowBreakpoints: (v: boolean) => void;
  setOverlayAlwaysOnTop: (v: boolean) => void;
  setEndgameEnabled: (v: boolean) => void;
  handleToggleOverlay: () => void;
  handleResetPosition: () => void;
  hotkeys: HotkeySettings;
}

function OverlayTab({
  overlayEnabled,
  overlayOpacity,
  overlayScale,
  overlayBgOpacity,
  overlayAccentColor,
  overlayShowTimer,
  overlayShowZone,
  overlayShowLastSplit,
  overlayShowBreakpoints,
  overlayAlwaysOnTop,
  overlayOpen,
  endgameEnabled,
  setOverlayEnabled,
  setOverlayOpacity,
  setOverlayScale,
  setOverlayBgOpacity,
  setOverlayAccentColor,
  setOverlayShowTimer,
  setOverlayShowZone,
  setOverlayShowLastSplit,
  setOverlayShowBreakpoints,
  setOverlayAlwaysOnTop,
  setEndgameEnabled,
  handleToggleOverlay,
  handleResetPosition,
  hotkeys,
}: OverlayTabProps) {
  return (
    <div className="card-inset rounded-lg p-4 space-y-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[--color-text] flex items-center gap-2">
            Enable Overlay
            <HelpTip>
              The overlay is a small always-on-top window that displays your timer, current zone, last split comparison, and upcoming breakpoints while you play. It can be dragged anywhere on screen and is fully compatible with OBS Window Capture.
            </HelpTip>
          </div>
          <div className="text-xs text-[--color-text-muted]">Show minimal timer as overlay window</div>
        </div>
        <Toggle checked={overlayEnabled} onChange={setOverlayEnabled} />
      </div>

      {/* Appearance */}
      <div className="pt-3 border-t border-[--color-border]">
        <h3 className="text-sm font-semibold text-[--color-text-muted] mb-3 uppercase tracking-wide flex items-center gap-2 flex-wrap">
          Appearance
          <HelpTip>
            Size controls the overlay window width. Window Opacity affects the entire overlay's transparency. Background Opacity controls just the dark background. Accent Color adds a colored border — useful for OBS chroma-key setups or visual distinction.
          </HelpTip>
        </h3>

        {/* Size */}
        <div className="mb-3">
          <label className="block text-sm text-[--color-text-muted] mb-2">Size</label>
          <div className="flex gap-2">
            {(['small', 'medium', 'large'] as const).map((size) => {
              const isSelected = overlayScale === size;
              return (
                <button
                  key={size}
                  onClick={() => setOverlayScale(size)}
                  className={`px-4 py-1.5 text-sm rounded-md border-2 transition-all active:scale-95 font-medium capitalize ${
                    isSelected
                      ? 'bg-[--color-poe-gold] text-[--color-poe-darker] border-[--color-poe-gold-light] shadow-sm'
                      : 'bg-[--color-surface] text-[--color-text] border-[--color-poe-gold]/30 hover:border-[--color-poe-gold]/60'
                  }`}
                >
                  {isSelected && '> '}{size}
                </button>
              );
            })}
          </div>
        </div>

        {/* Window Opacity */}
        <div className="mb-3">
          <label className="block text-sm text-[--color-text-muted] mb-2">
            Window Opacity: {Math.round(overlayOpacity * 100)}%
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

        {/* Background Opacity */}
        <div className="mb-3">
          <label className="block text-sm text-[--color-text-muted] mb-2">
            Background Opacity: {Math.round(overlayBgOpacity * 100)}%
          </label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={overlayBgOpacity}
            onChange={(e) => setOverlayBgOpacity(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Accent Color */}
        <div className="mb-3">
          <label className="block text-sm text-[--color-text-muted] mb-2">Accent Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'None', color: 'transparent' },
              { label: 'Green', color: '#22c55e' },
              { label: 'Blue', color: '#3b82f6' },
              { label: 'White', color: '#d1d5db' },
            ].map(({ label, color }) => {
              const isSelected = overlayAccentColor === color;
              return (
                <button
                  key={color}
                  onClick={() => setOverlayAccentColor(color)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 transition-all active:scale-95 font-medium ${
                    isSelected
                      ? 'bg-white/10 border-white/60 shadow-sm ring-1 ring-white/20'
                      : 'border-[--color-border] hover:border-white/30'
                  }`}
                  title={label}
                >
                  {color === 'transparent' ? (
                    <span className="w-3 h-3 rounded-full border border-[--color-text-muted] relative overflow-hidden">
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] text-[--color-text-muted]">-</span>
                    </span>
                  ) : (
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  )}
                  <span className={isSelected ? 'text-white' : 'text-[--color-text]'}>{label}</span>
                </button>
              );
            })}
            <input
              type="text"
              value={overlayAccentColor}
              onChange={(e) => setOverlayAccentColor(e.target.value)}
              placeholder="#af6025"
              className="w-24 px-2 py-1.5 text-sm bg-[--color-surface-elevated] border border-[--color-border] rounded-md text-[--color-text] font-mono"
            />
          </div>
        </div>
      </div>

      {/* Visible Sections */}
      <div className="pt-3 border-t border-[--color-border]">
        <h3 className="text-sm font-semibold text-[--color-text-muted] mb-3 uppercase tracking-wide flex items-center gap-2 flex-wrap">
          Visible Sections
          <HelpTip>
            Choose which information the overlay displays. Timer shows your run clock. Zone shows your current area. Last Split shows the delta vs your PB/reference. Upcoming Breakpoints shows your next splits with live PB pace comparison.
          </HelpTip>
        </h3>

        {[
          { label: 'Show Timer', value: overlayShowTimer, setter: setOverlayShowTimer },
          { label: 'Show Current Zone', value: overlayShowZone, setter: setOverlayShowZone },
          { label: 'Show Last Split', value: overlayShowLastSplit, setter: setOverlayShowLastSplit },
          { label: 'Show Upcoming Breakpoints', value: overlayShowBreakpoints, setter: setOverlayShowBreakpoints },
          { label: 'Endgame Mode', value: endgameEnabled, setter: setEndgameEnabled },
        ].map(({ label, value, setter }) => (
          <div key={label} className="flex items-center justify-between mb-2">
            <span className="text-sm text-[--color-text]">{label}</span>
            <Toggle checked={value} onChange={setter} size="sm" />
          </div>
        ))}
      </div>

      {/* Behavior */}
      <div className="pt-3 border-t border-[--color-border]">
        <h3 className="text-sm font-semibold text-[--color-text-muted] mb-3 uppercase tracking-wide flex items-center gap-2 flex-wrap">
          Behavior
          <HelpTip>
            Always on Top keeps the overlay above all other windows including PoE. For OBS capture: add a Window Capture source, select "PoE Watcher Overlay", and set Capture Method to "Windows 10 (1903 and up)".
          </HelpTip>
        </h3>

        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm text-[--color-text]">Always on Top</div>
            <div className="text-xs text-[--color-text-muted]">Keep overlay above other windows</div>
          </div>
          <Toggle checked={overlayAlwaysOnTop} onChange={setOverlayAlwaysOnTop} />
        </div>

        <div className="text-xs text-[--color-text-muted] mt-2">
          The overlay is OBS-compatible. In OBS, add a <span className="font-medium text-[--color-text]">Window Capture</span> for "PoE Watcher Overlay" with Capture Method set to <span className="font-medium text-[--color-text]">Windows 10 (1903 and up)</span>.
        </div>
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-[--color-border]">
        <h3 className="text-sm font-semibold text-[--color-text-muted] mb-3 uppercase tracking-wide">Actions</h3>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={overlayOpen ? 'destructive' : 'secondary'}
            onClick={handleToggleOverlay}
          >
            {overlayOpen ? 'Close Overlay' : 'Open Overlay'}
            <span className="ml-2 text-xs opacity-60">{hotkeys.toggleOverlay}</span>
          </Button>
          <Button variant="secondary" onClick={handleResetPosition}>
            Reset Position
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Shortcuts Tab ---------- */

interface ShortcutsTabProps {
  editingHotkeys: HotkeySettings;
  hotkeyErrors: Partial<Record<keyof HotkeySettings, string>>;
  hotkeyApplyStatus: 'idle' | 'applying' | 'applied' | 'error';
  hasHotkeyChanges: boolean;
  hasHotkeyErrors: boolean;
  handleHotkeyChange: (key: keyof HotkeySettings, value: string) => void;
  handleApplyHotkeys: () => void;
  handleResetHotkeys: () => void;
}

function ShortcutsTab({
  editingHotkeys,
  hotkeyErrors,
  hotkeyApplyStatus,
  hasHotkeyChanges,
  hasHotkeyErrors,
  handleHotkeyChange,
  handleApplyHotkeys,
  handleResetHotkeys,
}: ShortcutsTabProps) {
  return (
    <div className="card-inset rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2 mb-3">
        <p className="text-sm text-[--color-text-muted]">
          Customize global hotkeys. Click a shortcut to rebind it, then press your desired key combination (must include Ctrl, Shift, or Alt). Press Escape to cancel.
        </p>
        <HelpTip>
          These global hotkeys work even when PoE Watcher is not focused — they're registered system-wide. Click a shortcut field and press your desired key combination. Each shortcut must include at least one modifier key (Ctrl, Shift, or Alt). Press Escape while recording to cancel.
        </HelpTip>
      </div>
      {HOTKEY_ACTIONS.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between">
          <span className="text-sm text-[--color-text]">{label}</span>
          <HotkeyInput
            value={editingHotkeys[key]}
            onChange={(v) => handleHotkeyChange(key, v)}
            error={hotkeyErrors[key]}
          />
        </div>
      ))}
      <div className="flex gap-2 pt-3 border-t border-[--color-border]">
        <Button
          variant={
            hotkeyApplyStatus === 'applied' ? 'primary' :
            hotkeyApplyStatus === 'error' ? 'destructive' :
            'primary'
          }
          onClick={handleApplyHotkeys}
          disabled={!hasHotkeyChanges || hasHotkeyErrors || hotkeyApplyStatus === 'applying'}
          loading={hotkeyApplyStatus === 'applying'}
          className={
            hotkeyApplyStatus === 'applied'
              ? 'bg-[--color-timer-ahead] text-white border-green-400 hover:bg-[--color-timer-ahead]'
              : ''
          }
        >
          {hotkeyApplyStatus === 'applying' ? 'Applying...' :
           hotkeyApplyStatus === 'applied' ? 'Applied!' :
           hotkeyApplyStatus === 'error' ? 'Error!' :
           'Apply Shortcuts'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleResetHotkeys}
          disabled={hotkeyApplyStatus === 'applying'}
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
