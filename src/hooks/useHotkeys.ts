import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useRunStore } from '../stores/runStore';
import { useSettingsStore } from '../stores/settingsStore';

interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
}

export function useHotkeys() {
  const { timer, startTimer, stopTimer, setRunId } = useRunStore();
  const { accountName } = useSettingsStore();

  // Toggle timer (start/pause)
  const toggleTimer = useCallback(async () => {
    if (timer.isRunning) {
      stopTimer();
    } else {
      const isNewRun = timer.elapsedMs === 0;

      // Start the timer
      startTimer();

      // If this is a fresh start, create the run in the database
      if (isNewRun) {
        const state = useRunStore.getState();
        const run = state.currentRun;

        if (run) {
          try {
            const dbRunId = await invoke<number>('create_run', {
              run: {
                character_name: run.characterName || run.character || 'Unknown',
                account_name: accountName || '',
                class: run.class || 'Unknown',
                ascendancy: run.ascendancy || null,
                league: run.league || 'Standard',
                category: run.category || 'any%',
                started_at: run.startedAt || new Date().toISOString(),
              },
            });
            console.log('[useHotkeys] Run created in database with ID:', dbRunId);
            setRunId(dbRunId);
          } catch (error) {
            console.error('[useHotkeys] Failed to create run in database:', error);
          }
        }
      }
    }
  }, [timer.isRunning, timer.elapsedMs, startTimer, stopTimer, setRunId, accountName]);

  // Define hotkeys
  const hotkeys: HotkeyConfig[] = [
    {
      key: ' ', // Space
      ctrl: true,
      action: toggleTimer,
    },
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger hotkeys when typing in inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      for (const hotkey of hotkeys) {
        const ctrlMatch = hotkey.ctrl ? event.ctrlKey : !event.ctrlKey;
        const shiftMatch = hotkey.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = hotkey.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key === hotkey.key;

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          hotkey.action();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys]);

  // Listen for global shortcut events from the backend (works when window is not focused)
  useEffect(() => {
    const unlistenGlobal = listen<string>('global-shortcut', (event) => {
      console.log('[useHotkeys] Global shortcut received:', event.payload);
      if (event.payload === 'toggle-timer') {
        toggleTimer();
      }
    });

    return () => {
      unlistenGlobal.then((fn) => fn());
    };
  }, [toggleTimer]);
}
