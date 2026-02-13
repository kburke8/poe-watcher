import { useEffect, useCallback, useMemo, useRef } from 'react';
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

/** Parses a Tauri shortcut string like "Ctrl+Shift+Space" into HotkeyConfig fields */
function parseShortcutToHotkeyConfig(shortcut: string): { key: string; ctrl: boolean; shift: boolean; alt: boolean } {
  const parts = shortcut.split('+');
  const ctrl = parts.includes('Ctrl');
  const shift = parts.includes('Shift');
  const alt = parts.includes('Alt');
  // The key is the last non-modifier part
  const keyPart = parts.filter(p => !['Ctrl', 'Shift', 'Alt'].includes(p)).pop() || '';

  // Map Tauri key names back to browser KeyboardEvent.key values
  const keyMap: Record<string, string> = {
    'Space': ' ',
    'Up': 'ArrowUp',
    'Down': 'ArrowDown',
    'Left': 'ArrowLeft',
    'Right': 'ArrowRight',
  };

  const key = keyMap[keyPart] || (keyPart.length === 1 ? keyPart.toLowerCase() : keyPart);
  return { key, ctrl, shift, alt };
}

export function useHotkeys() {
  const { timer, startTimer, stopTimer, resetRun, setRunId } = useRunStore();
  const { accountName, testCharacterName, hotkeys: hotkeyConfig } = useSettingsStore();

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

  // Manual split - triggers the next expected breakpoint
  const triggerManualSplit = useCallback(() => {
    const { timer: t } = useRunStore.getState();
    if (!t.isRunning) return;

    const { breakpoints } = useSettingsStore.getState();
    const completedSplits = new Set(t.splits.map(s => s.name));

    // Find the next enabled breakpoint that hasn't been completed yet
    for (const bp of breakpoints) {
      if (!bp.isEnabled) continue;
      if (completedSplits.has(bp.name)) continue;

      // Emit a split-trigger event for this breakpoint
      // The useTauriEvents hook listens for this and handles the actual split logic
      import('@tauri-apps/api/event').then(({ emit }) => {
        emit('split-trigger', { name: bp.name, type: bp.type });
      });
      return;
    }
  }, []);

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

  // Debounce ref: prevents the same action from firing twice when both the
  // local keydown handler and the Tauri global-shortcut event trigger for the
  // same keypress (OS-level shortcut + browser keydown can both fire).
  const lastActionRef = useRef(0);
  const debounced = useCallback((action: () => void) => {
    const now = Date.now();
    if (now - lastActionRef.current < 300) return;
    lastActionRef.current = now;
    action();
  }, []);

  // Build hotkeys dynamically from store config
  const hotkeys: HotkeyConfig[] = useMemo(() => {
    const toggleTimerParsed = parseShortcutToHotkeyConfig(hotkeyConfig.toggleTimer);
    const resetTimerParsed = parseShortcutToHotkeyConfig(hotkeyConfig.resetTimer);
    const snapshotParsed = parseShortcutToHotkeyConfig(hotkeyConfig.manualSnapshot);
    const splitParsed = parseShortcutToHotkeyConfig(hotkeyConfig.manualSplit);

    return [
      { ...toggleTimerParsed, action: toggleTimer },
      { ...resetTimerParsed, action: resetTimer },
      { ...snapshotParsed, action: captureManualSnapshot },
      { ...splitParsed, action: triggerManualSplit },
    ];
  }, [hotkeyConfig.toggleTimer, hotkeyConfig.resetTimer, hotkeyConfig.manualSnapshot, hotkeyConfig.manualSplit, toggleTimer, resetTimer, captureManualSnapshot, triggerManualSplit]);

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
        // Case-insensitive: event.key is uppercase when Shift is held
        const keyMatch = event.key.toLowerCase() === hotkey.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          debounced(hotkey.action);
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

  // Listen for global shortcut events from the backend (works even when window is not focused).
  // Uses the same debounce to avoid double-firing with the local keydown handler.
  useEffect(() => {
    const unlistenGlobal = listen<string>('global-shortcut', (event) => {
      if (event.payload === 'toggle-timer') {
        debounced(toggleTimer);
      } else if (event.payload === 'reset-timer') {
        debounced(resetTimer);
      } else if (event.payload === 'manual-snapshot') {
        debounced(captureManualSnapshot);
      } else if (event.payload === 'manual-split') {
        debounced(triggerManualSplit);
      } else if (event.payload === 'toggle-overlay') {
        debounced(toggleOverlay);
      }
    });

    return () => {
      unlistenGlobal.then((fn) => fn());
    };
  }, [toggleTimer, resetTimer, captureManualSnapshot, triggerManualSplit, toggleOverlay, debounced]);
}
