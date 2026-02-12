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
  const { timer, startTimer, stopTimer, resetRun, setRunId } = useRunStore();
  const { accountName, testCharacterName } = useSettingsStore();

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
            // Get breakpoint preset info
            const presetName = useSettingsStore.getState().getCurrentPresetName();
            const enabledBreakpoints = useSettingsStore.getState().getEnabledBreakpointNames();

            const dbRunId = await invoke<number>('create_run', {
              run: {
                characterName: run.characterName || run.character || testCharacterName || 'Unknown',
                accountName: accountName || '',
                class: run.class || 'Unknown',
                ascendancy: run.ascendancy || null,
                league: run.league || 'Standard',
                category: run.category || 'any%',
                startedAt: run.startedAt || new Date().toISOString(),
                breakpointPreset: presetName,
                enabledBreakpoints: JSON.stringify(enabledBreakpoints),
              },
            });
            setRunId(dbRunId);
          } catch (error) {
            console.error('[useHotkeys] Failed to create run in database:', error);
          }
        }
      }
    }
  }, [timer.isRunning, timer.elapsedMs, startTimer, stopTimer, setRunId, accountName, testCharacterName]);

  // Reset timer
  const resetTimer = useCallback(() => {
    resetRun();
    // Disable fast polling on reset
    invoke('set_log_poll_fast', { enabled: false }).catch(() => {});
  }, [resetRun]);

  // Manual snapshot capture - works whether timer is running or paused
  const captureManualSnapshot = useCallback(async () => {
    const { currentRun, timer: t } = useRunStore.getState();
    if (!currentRun?.id) {
      return;
    }

    const { accountName: acct, testCharacterName: testChar } = useSettingsStore.getState();
    const detectedChar = currentRun.characterName || currentRun.character;
    const charName = (detectedChar && detectedChar !== 'Unknown') ? detectedChar : testChar;
    if (!acct || !charName || charName === 'Unknown') {
      return;
    }

    const elapsedMs = t.isRunning && t.startTime
      ? Date.now() - t.startTime
      : t.elapsedMs;

    const splitName = t.currentZone || 'Manual Snapshot';
    const segmentTimeMs = t.splits.length > 0
      ? elapsedMs - t.splits[t.splits.length - 1].splitTimeMs
      : elapsedMs;

    try {
      await invoke('add_split', {
        request: {
          split: {
            runId: currentRun.id,
            breakpointType: 'custom',
            breakpointName: splitName,
            splitTimeMs: elapsedMs,
            deltaMs: null,
            segmentTimeMs,
            townTimeMs: t.townTimeMs,
            hideoutTimeMs: t.hideoutTimeMs,
          },
          capture_snapshot: true,
          account_name: acct,
          character_name: charName,
        },
      });
    } catch (error) {
      console.error('[useHotkeys] Failed to capture manual snapshot:', error);
    }
  }, []);

  // Define hotkeys
  const hotkeys: HotkeyConfig[] = [
    {
      key: ' ', // Space
      ctrl: true,
      action: toggleTimer,
    },
    {
      key: ' ', // Space
      ctrl: true,
      shift: true,
      action: resetTimer,
    },
    {
      key: ' ', // Space
      ctrl: true,
      alt: true,
      action: captureManualSnapshot,
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

  // Toggle overlay
  const toggleOverlay = useCallback(async () => {
    try {
      const isOpen = await invoke<boolean>('toggle_overlay');
      useSettingsStore.getState().setOverlayOpen(isOpen);
    } catch (error) {
      console.error('[useHotkeys] Failed to toggle overlay:', error);
    }
  }, []);

  // Listen for global shortcut events from the backend (works when window is not focused)
  useEffect(() => {
    const unlistenGlobal = listen<string>('global-shortcut', (event) => {
      if (event.payload === 'toggle-timer') {
        toggleTimer();
      } else if (event.payload === 'reset-timer') {
        resetTimer();
      } else if (event.payload === 'manual-snapshot') {
        captureManualSnapshot();
      } else if (event.payload === 'toggle-overlay') {
        toggleOverlay();
      }
    });

    return () => {
      unlistenGlobal.then((fn) => fn());
    };
  }, [toggleTimer, resetTimer, captureManualSnapshot, toggleOverlay]);
}
