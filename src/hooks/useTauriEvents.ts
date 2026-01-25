import { useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useRunStore } from '../stores/runStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSnapshotStore } from '../stores/snapshotStore';
import { isTownZone, isHideoutZone } from '../config/breakpoints';
import type { Settings, Snapshot } from '../types';

interface LogEventPayload {
  event_type: string;
  timestamp: string;
  zone_name?: string;
  character_name?: string;
  character_class?: string;
  level?: number;
}

interface SettingsPayload {
  settings: Settings;
}

interface SnapshotCapturingPayload {
  split_id: number;
  breakpoint_name?: string;
}

interface SnapshotCompletePayload {
  split_id: number;
  snapshot_id: number;
  character_level: number;
}

interface SnapshotFailedPayload {
  split_id: number;
  error: string;
}

export function useTauriEvents() {
  const { addSplit } = useRunStore();
  const { loadSettings } = useSettingsStore();
  const { addPendingCapture, addFailedCapture, addSnapshot } = useSnapshotStore();

  // Handle triggering a split when a breakpoint matches
  const triggerSplit = useCallback(async (breakpointName: string, breakpointType: string) => {
    const { timer, currentRun } = useRunStore.getState();
    const { accountName } = useSettingsStore.getState();
    console.log('[useTauriEvents] triggerSplit called:', breakpointName, 'timer.isRunning:', timer.isRunning, 'currentRun:', !!currentRun);

    // Only trigger splits if timer is running
    if (!timer.isRunning) {
      console.log('[useTauriEvents] Split skipped - timer not running');
      return;
    }

    // Check if this split was already recorded
    const alreadyRecorded = timer.splits.some(s => s.name === breakpointName);
    if (alreadyRecorded) {
      console.log('[useTauriEvents] Split skipped - already recorded:', breakpointName);
      return;
    }

    // Determine if we should capture a snapshot
    // Check the breakpoint's captureSnapshot setting
    const { breakpoints } = useSettingsStore.getState();
    const matchedBreakpoint = breakpoints.find(bp => bp.name === breakpointName);
    const characterName = currentRun?.characterName || currentRun?.character;
    const hasValidCharacter = characterName && characterName !== 'Unknown';
    const shouldCaptureSnapshot =
      matchedBreakpoint?.captureSnapshot &&
      accountName &&
      hasValidCharacter;

    const splitTimeMs = timer.elapsedMs;
    const segmentTimeMs = timer.splits.length > 0
      ? timer.elapsedMs - timer.splits[timer.splits.length - 1].splitTimeMs
      : timer.elapsedMs;

    console.log('[useTauriEvents] Triggering split:', breakpointName, 'at', splitTimeMs, 'ms',
      'captureSnapshot:', shouldCaptureSnapshot);

    // Add split to local state
    addSplit({
      breakpointType: breakpointType as 'zone' | 'level' | 'boss' | 'act' | 'lab' | 'custom',
      breakpointName: breakpointName,
      splitTimeMs,
      segmentTimeMs,
      deltaMs: null,
    });

    // Send to backend with snapshot capture request
    if (currentRun?.id) {
      try {
        await invoke('add_split', {
          request: {
            split: {
              run_id: currentRun.id,
              breakpoint_type: breakpointType,
              breakpoint_name: breakpointName,
              split_time_ms: splitTimeMs,
              delta_ms: null,
              segment_time_ms: segmentTimeMs,
            },
            capture_snapshot: shouldCaptureSnapshot,
            account_name: accountName || null,
            character_name: characterName || null,
          },
        });
      } catch (error) {
        console.error('[useTauriEvents] Failed to add split to backend:', error);
      }
    }
  }, [addSplit]);

  // Check if a zone matches the NEXT expected breakpoint (sequential matching)
  const checkZoneBreakpoint = useCallback((zoneName: string) => {
    const { breakpoints } = useSettingsStore.getState();
    const { timer } = useRunStore.getState();
    console.log('[useTauriEvents] Checking zone breakpoint for:', zoneName);

    // Get list of already completed split names
    const completedSplits = new Set(timer.splits.map(s => s.name));

    // Find the next enabled zone breakpoint that hasn't been completed yet
    for (const bp of breakpoints) {
      if (!bp.isEnabled) continue;
      if (bp.trigger.type !== 'zone') continue;
      if (completedSplits.has(bp.name)) continue; // Skip already completed

      // This is the next expected breakpoint - check if it matches
      if (bp.trigger.zoneName?.toLowerCase() === zoneName.toLowerCase()) {
        console.log('[useTauriEvents] Breakpoint matched (next in sequence):', bp.name);
        triggerSplit(bp.name, bp.type);
        return;
      } else {
        // The next expected breakpoint doesn't match this zone, so don't trigger anything
        // This prevents skipping ahead (e.g., triggering Act 6 when still in Act 1)
        console.log('[useTauriEvents] Zone does not match next expected breakpoint:', bp.name, '(expected zone:', bp.trigger.zoneName, ')');
        return;
      }
    }
    console.log('[useTauriEvents] No more breakpoints to match');
  }, [triggerSplit]);

  // Check if a level matches any enabled breakpoint
  const checkLevelBreakpoint = useCallback((level: number) => {
    const { breakpoints } = useSettingsStore.getState();

    for (const bp of breakpoints) {
      if (!bp.isEnabled) continue;
      if (bp.trigger.type !== 'level') continue;

      if (bp.trigger.level === level) {
        triggerSplit(bp.name, bp.type);
        return;
      }
    }
  }, [triggerSplit]);

  // Handle log events
  const handleLogEvent = useCallback((payload: LogEventPayload) => {
    const { event_type } = payload;
    console.log('[useTauriEvents] Received event:', event_type, payload);

    switch (event_type) {
      case 'zone_enter':
        if (payload.zone_name) {
          console.log('[useTauriEvents] Zone entered:', payload.zone_name);

          // Track zone for town/hideout time calculation
          const { enterZone } = useRunStore.getState();
          const isTown = isTownZone(payload.zone_name);
          const isHideout = isHideoutZone(payload.zone_name);
          console.log('[useTauriEvents] Zone is town:', isTown, 'hideout:', isHideout);
          enterZone(payload.zone_name, isTown, isHideout);

          checkZoneBreakpoint(payload.zone_name);
        }
        break;

      case 'level_up':
        if (payload.level) {
          console.log('[useTauriEvents] Level up:', payload.character_name, 'to level', payload.level);

          // Auto-detect character name from level-up event
          if (payload.character_name) {
            const { currentRun } = useRunStore.getState();
            const currentChar = currentRun?.characterName || currentRun?.character;
            if (currentRun && (!currentChar || currentChar === 'Unknown')) {
              console.log('[useTauriEvents] Auto-detected character name:', payload.character_name);
              useRunStore.setState({
                currentRun: {
                  ...currentRun,
                  character: payload.character_name,
                  characterName: payload.character_name,
                  class: payload.character_class || currentRun.class,
                },
              });
            }
          }

          checkLevelBreakpoint(payload.level);
        }
        break;

      case 'death':
        console.log('[useTauriEvents] Death:', payload.character_name);
        // Could track deaths in run stats
        break;

      case 'login':
        console.log('[useTauriEvents] Login detected');
        break;

      default:
        console.log('[useTauriEvents] Unknown event:', event_type, payload);
    }
  }, [checkZoneBreakpoint, checkLevelBreakpoint]);

  useEffect(() => {
    console.log('[useTauriEvents] Setting up event listeners...');

    // Listen for log events from the Rust backend
    const unlistenLogEvent = listen<LogEventPayload>('log-event', (event) => {
      console.log('[useTauriEvents] RAW EVENT RECEIVED:', event);
      handleLogEvent(event.payload);
    });

    // Listen for settings loaded from backend
    const unlistenSettings = listen<SettingsPayload>('settings-loaded', (event) => {
      loadSettings(event.payload.settings);
    });

    // Listen for split triggers (manual or from backend)
    const unlistenSplit = listen<{ name: string; type: string }>('split-trigger', (event) => {
      triggerSplit(event.payload.name, event.payload.type);
    });

    // Listen for snapshot events
    const unlistenSnapshotCapturing = listen<SnapshotCapturingPayload>('snapshot-capturing', (event) => {
      console.log('[useTauriEvents] Snapshot capturing:', event.payload);
      addPendingCapture(event.payload.split_id);
    });

    const unlistenSnapshotComplete = listen<SnapshotCompletePayload>('snapshot-complete', async (event) => {
      console.log('[useTauriEvents] Snapshot complete:', event.payload);
      // Fetch the full snapshot data
      try {
        const snapshot = await invoke<Snapshot | null>('get_snapshot', {
          snapshotId: event.payload.snapshot_id,
        });
        if (snapshot) {
          addSnapshot(snapshot);
        }
      } catch (error) {
        console.error('[useTauriEvents] Failed to fetch snapshot:', error);
      }
    });

    const unlistenSnapshotFailed = listen<SnapshotFailedPayload>('snapshot-failed', (event) => {
      console.log('[useTauriEvents] Snapshot failed:', event.payload);
      addFailedCapture(event.payload.split_id, event.payload.error);
    });

    // Cleanup listeners on unmount
    return () => {
      unlistenLogEvent.then((fn) => fn());
      unlistenSettings.then((fn) => fn());
      unlistenSplit.then((fn) => fn());
      unlistenSnapshotCapturing.then((fn) => fn());
      unlistenSnapshotComplete.then((fn) => fn());
      unlistenSnapshotFailed.then((fn) => fn());
    };
  }, [handleLogEvent, loadSettings, triggerSplit, addPendingCapture, addSnapshot, addFailedCapture]);
}
