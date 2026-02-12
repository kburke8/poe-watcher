import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "./stores/settingsStore";
import { useRunStore } from "./stores/runStore";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { useHotkeys } from "./hooks/useHotkeys";
import { useOverlaySync } from "./hooks/useOverlaySync";
import { Sidebar } from "./components/Sidebar";
import { TimerView } from "./components/Timer/TimerView";
import { SnapshotView } from "./components/Snapshot/SnapshotView";
import { ComparisonView } from "./components/Comparison/ComparisonView";
import { HistoryView } from "./components/History/HistoryView";
import { SettingsView } from "./components/Settings/SettingsView";
import { defaultBreakpoints } from "./config/breakpoints";
import type { Breakpoint, PersonalBest, GoldSplit, Split, WizardConfig } from "./types";

const BREAKPOINTS_STORAGE_KEY = 'poe-watcher-breakpoints';
const WIZARD_CONFIG_STORAGE_KEY = 'poe-watcher-wizard-config';

function App() {
  const currentView = useSettingsStore((state) => state.currentView);
  const breakpoints = useSettingsStore((state) => state.breakpoints);
  const { setLogPath, loadSettings } = useSettingsStore();

  // Initialize Tauri event listeners
  useTauriEvents();

  // Initialize global hotkeys (Ctrl+Space to start/pause timer)
  useHotkeys();

  // Sync state to overlay window
  useOverlaySync();

  // Auto-save breakpoints to localStorage whenever they change (after initial load)
  useEffect(() => {
    // Skip the initial render (before settings are loaded)
    const isInitialLoad = breakpoints === defaultBreakpoints;
    if (isInitialLoad) return;

    try {
      const seen = new Set<string>();
      const deduplicated = breakpoints.filter((bp) => {
        if (seen.has(bp.name)) return false;
        seen.add(bp.name);
        return true;
      });
      localStorage.setItem(BREAKPOINTS_STORAGE_KEY, JSON.stringify(deduplicated));
    } catch (e) {
      console.error('[App] Failed to save breakpoints:', e);
    }
  }, [breakpoints]);

  // Load settings and start log watcher on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Load breakpoints from localStorage first (before anything else)
        try {
          const saved = localStorage.getItem(BREAKPOINTS_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Deduplicate by name
              const seen = new Set<string>();
              const deduplicated = parsed.filter((bp: { name: string }) => {
                if (seen.has(bp.name)) return false;
                seen.add(bp.name);
                return true;
              });

              // Merge with defaults to add any missing fields
              const defaultBpMap = new Map(defaultBreakpoints.map(bp => [bp.name, bp]));
              const migrated = deduplicated.map((bp: Breakpoint) => {
                const defaultBp = defaultBpMap.get(bp.name);
                return {
                  ...defaultBp,
                  ...bp,
                  captureSnapshot: bp.captureSnapshot ?? defaultBp?.captureSnapshot ?? false,
                };
              });

              useSettingsStore.getState().setBreakpoints(migrated);
            }
          } else {
            // No saved breakpoints - apply speedrun preset
            useSettingsStore.getState().applySpeedrunPreset();
          }
        } catch (e) {
          console.error('[App] Failed to load breakpoints:', e);
        }

        // Load wizard config from localStorage
        try {
          const savedWizard = localStorage.getItem(WIZARD_CONFIG_STORAGE_KEY);
          if (savedWizard) {
            const parsed = JSON.parse(savedWizard) as WizardConfig;
            if (parsed && parsed.endAct && parsed.verbosity) {
              useSettingsStore.getState().loadSettings({ wizardConfig: parsed });
            }
          }
        } catch (e) {
          console.error('[App] Failed to load wizard config:', e);
        }

        // Load saved settings from backend
        const settings = await invoke<{
          poe_log_path: string;
          account_name: string;
          overlay_enabled: boolean;
          overlay_opacity: number;
          sound_enabled: boolean;
          overlay_scale: string;
          overlay_font_size: string;
          overlay_show_timer: boolean;
          overlay_show_zone: boolean;
          overlay_show_last_split: boolean;
          overlay_show_breakpoints: boolean;
          overlay_breakpoint_count: number;
          overlay_bg_opacity: number;
          overlay_accent_color: string;
          overlay_always_on_top: boolean;
          overlay_locked: boolean;
        } | null>('get_settings');

        if (settings) {
          loadSettings({
            poeLogPath: settings.poe_log_path,
            accountName: settings.account_name,
            overlayEnabled: settings.overlay_enabled,
            overlayOpacity: settings.overlay_opacity,
            soundEnabled: settings.sound_enabled,
            overlayScale: (settings.overlay_scale || 'medium') as 'small' | 'medium' | 'large',
            overlayFontSize: (settings.overlay_font_size || 'medium') as 'small' | 'medium' | 'large',
            overlayShowTimer: settings.overlay_show_timer ?? true,
            overlayShowZone: settings.overlay_show_zone ?? true,
            overlayShowLastSplit: settings.overlay_show_last_split ?? true,
            overlayShowBreakpoints: settings.overlay_show_breakpoints ?? true,
            overlayBreakpointCount: settings.overlay_breakpoint_count ?? 3,
            overlayBgOpacity: settings.overlay_bg_opacity ?? 0.9,
            overlayAccentColor: settings.overlay_accent_color || 'transparent',
            overlayAlwaysOnTop: settings.overlay_always_on_top ?? true,
            overlayLocked: settings.overlay_locked ?? false,
          });

          // Start log watcher if we have a path
          if (settings.poe_log_path) {
            await invoke('start_log_watcher', { logPath: settings.poe_log_path });
          }
        } else {
          // Try to auto-detect log path
          const detectedPath = await invoke<string | null>('detect_log_path_cmd');
          if (detectedPath) {
            setLogPath(detectedPath);
            await invoke('start_log_watcher', { logPath: detectedPath });
          }
        }

        // Load PB splits and gold splits for comparison
        await loadPbAndGoldSplits();
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };

    const loadPbAndGoldSplits = async () => {
      try {
        // Load personal bests to get PB run IDs
        const pbs = await invoke<PersonalBest[]>('get_personal_bests');

        // Build map of PB split times: key = "category-class-breakpointName" -> splitTimeMs
        const pbSplitMap = new Map<string, number>();

        for (const pb of pbs) {
          try {
            // Get splits for this PB run
            const splits = await invoke<Split[]>('get_splits', { runId: pb.runId });
            for (const split of splits) {
              const key = `${pb.category}-${pb.class}-${split.breakpointName}`;
              pbSplitMap.set(key, split.splitTimeMs);
            }
          } catch {
            // Skip PB runs whose splits can't be loaded
          }
        }
        useRunStore.getState().setPersonalBests(pbSplitMap);

        // Load gold splits (best segment times)
        const golds = await invoke<GoldSplit[]>('get_gold_splits');
        const goldMap = new Map<string, number>();
        for (const gold of golds) {
          const key = `${gold.category}-${gold.breakpointName}`;
          goldMap.set(key, gold.bestSegmentMs);
        }
        useRunStore.getState().setGoldSplits(goldMap);
      } catch (error) {
        console.error('[App] Failed to load PB/gold splits:', error);
      }
    };

    initialize();
  }, [loadSettings, setLogPath]);

  const renderView = () => {
    switch (currentView) {
      case 'timer':
        return <TimerView />;
      case 'snapshots':
        return <SnapshotView />;
      case 'comparison':
        return <ComparisonView />;
      case 'history':
        return <HistoryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <TimerView />;
    }
  };

  return (
    <div className="flex h-screen bg-[--color-poe-darker]">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
