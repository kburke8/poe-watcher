import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "./stores/settingsStore";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { useHotkeys } from "./hooks/useHotkeys";
import { Sidebar } from "./components/Sidebar";
import { TimerView } from "./components/Timer/TimerView";
import { SnapshotView } from "./components/Snapshot/SnapshotView";
import { ComparisonView } from "./components/Comparison/ComparisonView";
import { HistoryView } from "./components/History/HistoryView";
import { SettingsView } from "./components/Settings/SettingsView";
import { defaultBreakpoints } from "./config/breakpoints";
import type { Breakpoint } from "./types";

const BREAKPOINTS_STORAGE_KEY = 'poe-watcher-breakpoints';

function App() {
  const currentView = useSettingsStore((state) => state.currentView);
  const breakpoints = useSettingsStore((state) => state.breakpoints);
  const { setLogPath, loadSettings } = useSettingsStore();

  // Initialize Tauri event listeners
  useTauriEvents();

  // Initialize global hotkeys (Ctrl+Space to start/pause timer)
  useHotkeys();

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
      console.log('[App] Auto-saved breakpoints:', deduplicated.length);
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
              console.log('[App] Loaded breakpoints from localStorage:', migrated.length);
            }
          } else {
            // No saved breakpoints - apply speedrun preset
            console.log('[App] No saved breakpoints, applying speedrun preset');
            useSettingsStore.getState().applySpeedrunPreset();
          }
        } catch (e) {
          console.error('[App] Failed to load breakpoints:', e);
        }

        // Load saved settings from backend
        const settings = await invoke<{
          poe_log_path: string;
          account_name: string;
          overlay_enabled: boolean;
          overlay_opacity: number;
          sound_enabled: boolean;
        } | null>('get_settings');

        if (settings) {
          loadSettings({
            poeLogPath: settings.poe_log_path,
            accountName: settings.account_name,
            overlayEnabled: settings.overlay_enabled,
            overlayOpacity: settings.overlay_opacity,
            soundEnabled: settings.sound_enabled,
          });

          // Start log watcher if we have a path
          if (settings.poe_log_path) {
            await invoke('start_log_watcher', { logPath: settings.poe_log_path });
            console.log('Log watcher started for:', settings.poe_log_path);
          }
        } else {
          // Try to auto-detect log path
          const detectedPath = await invoke<string | null>('detect_log_path_cmd');
          if (detectedPath) {
            setLogPath(detectedPath);
            await invoke('start_log_watcher', { logPath: detectedPath });
            console.log('Log watcher started for auto-detected path:', detectedPath);
          }
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
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
