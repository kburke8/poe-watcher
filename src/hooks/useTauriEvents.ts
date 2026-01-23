import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useRunStore } from '../stores/runStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { LogEvent, Settings } from '../types';

interface LogEventPayload {
  event_type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface SettingsPayload {
  settings: Settings;
}

export function useTauriEvents() {
  const { addSplit, startRun, currentRun } = useRunStore();
  const { loadSettings } = useSettingsStore();

  useEffect(() => {
    // Listen for log events from the Rust backend
    const unlistenLogEvent = listen<LogEventPayload>('log-event', (event) => {
      const payload = event.payload;
      handleLogEvent(payload);
    });

    // Listen for settings loaded from backend
    const unlistenSettings = listen<SettingsPayload>('settings-loaded', (event) => {
      loadSettings(event.payload.settings);
    });

    // Listen for split triggers
    const unlistenSplit = listen<{ name: string; type: string }>('split-trigger', (event) => {
      if (currentRun) {
        const { timer } = useRunStore.getState();
        addSplit({
          breakpointType: event.payload.type as 'zone' | 'level' | 'boss' | 'act' | 'lab' | 'custom',
          breakpointName: event.payload.name,
          splitTimeMs: timer.elapsedMs,
          segmentTimeMs: timer.splits.length > 0
            ? timer.elapsedMs - timer.splits[timer.splits.length - 1].splitTimeMs
            : timer.elapsedMs,
        });
      }
    });

    // Cleanup listeners on unmount
    return () => {
      unlistenLogEvent.then((fn) => fn());
      unlistenSettings.then((fn) => fn());
      unlistenSplit.then((fn) => fn());
    };
  }, [addSplit, loadSettings, currentRun]);

  const handleLogEvent = (payload: LogEventPayload) => {
    const { event_type, data } = payload;

    switch (event_type) {
      case 'zone_enter':
        console.log('Zone entered:', data.zone_name);
        // Zone entry handling will be done by the breakpoint system
        break;

      case 'level_up':
        console.log('Level up:', data.character_name, 'to level', data.level);
        // Level up handling will trigger level-based breakpoints
        break;

      case 'death':
        console.log('Death:', data.character_name);
        // Track deaths during the run
        break;

      case 'login':
        console.log('Login detected');
        break;

      default:
        console.log('Unknown event:', event_type);
    }
  };
}
