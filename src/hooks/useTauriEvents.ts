import { useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useRunStore } from '../stores/runStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSnapshotStore } from '../stores/snapshotStore';
import { useGroupStore } from '../stores/groupStore';
import { usePracticeStore } from '../stores/practiceStore';
import { isTownZone, isHideoutZone } from '../config/breakpoints';
import { getBossFromDialog } from '../config/bossDialogs';
import type { Settings, Snapshot } from '../types';

interface LogEventPayload {
  event_type: string;
  timestamp: string;
  zone_name?: string;
  character_name?: string;
  character_class?: string;
  level?: number;
  penalty?: number;
  npc_name?: string;
  dialog_text?: string;
  area_name?: string;
  seed?: number;
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

  // Check if the next uncompleted breakpoint is a kitava trigger and toggle fast polling
  const updatePollingSpeed = useCallback((completedSplitNames: Set<string>) => {
    const { breakpoints } = useSettingsStore.getState();

    // Find the next enabled, uncompleted breakpoint
    for (const bp of breakpoints) {
      if (!bp.isEnabled) continue;
      if (completedSplitNames.has(bp.name)) continue;

      // This is the next uncompleted breakpoint
      const needsFast = bp.trigger.type === 'kitava';
      invoke('set_log_poll_fast', { enabled: needsFast }).catch(() => {});
      if (import.meta.env.DEV && needsFast) {
        console.log('[useTauriEvents] Fast polling enabled - waiting for Kitava split:', bp.name);
      }
      return;
    }
  }, []);

  // Handle triggering a split when a breakpoint matches
  const triggerSplit = useCallback(async (breakpointName: string, breakpointType: string) => {
    const { timer, currentRun } = useRunStore.getState();
    const { accountName } = useSettingsStore.getState();
    // Only trigger splits if timer is running
    if (!timer.isRunning) {
      return;
    }

    // Check if this split was already recorded
    const alreadyRecorded = timer.splits.some(s => s.name === breakpointName);
    if (alreadyRecorded) {
      return;
    }

    // Determine if we should capture a snapshot
    // Check the breakpoint's captureSnapshot setting
    const { breakpoints, testCharacterName } = useSettingsStore.getState();
    const matchedBreakpoint = breakpoints.find(bp => bp.name === breakpointName);
    const detectedCharacter = currentRun?.characterName || currentRun?.character;
    // Use detected character if valid, otherwise fall back to test character name
    const characterName = (detectedCharacter && detectedCharacter !== 'Unknown')
      ? detectedCharacter
      : testCharacterName;
    const hasValidCharacter = characterName && characterName !== 'Unknown';
    const shouldCaptureSnapshot =
      matchedBreakpoint?.captureSnapshot &&
      accountName &&
      hasValidCharacter;

    // Calculate actual elapsed time - timer.elapsedMs is only updated during UI renders
    const actualElapsedMs = timer.isRunning && timer.startTime
      ? Date.now() - timer.startTime
      : timer.elapsedMs;

    const splitTimeMs = actualElapsedMs;
    const segmentTimeMs = timer.splits.length > 0
      ? actualElapsedMs - timer.splits[timer.splits.length - 1].splitTimeMs
      : actualElapsedMs;

    // Get current town/hideout time from timer state
    const townTimeMs = timer.townTimeMs;
    const hideoutTimeMs = timer.hideoutTimeMs;

    if (import.meta.env.DEV) {
      console.log('[useTauriEvents] Triggering split:', breakpointName, 'at', splitTimeMs, 'ms');
    }

    // Get cumulative death count
    const deathCount = timer.deathCount;

    // Calculate boss fight time for this segment
    const prevSplitIndex = timer.splits.length - 1;
    let bossFightMs = 0;

    // Sum completed boss encounters that belong to this segment
    for (const encounter of timer.bossEncounters) {
      if (encounter.afterSplitIndex === prevSplitIndex && encounter.durationMs != null) {
        bossFightMs += encounter.durationMs;
      }
    }

    // Include active boss encounter if it belongs to this segment
    if (timer.activeBossEncounter && timer.activeBossEncounter.afterSplitIndex === prevSplitIndex) {
      const now = Date.now();
      // Subtract town time during this active fight
      const townDuringFight = timer.townVisits
        .filter(v => v.enteredAt >= timer.activeBossEncounter!.startedAt && v.exitedAt !== null)
        .reduce((sum, v) => sum + v.durationMs, 0);
      bossFightMs += (now - timer.activeBossEncounter.startedAt) - townDuringFight;
    }

    // Add split to local state
    addSplit({
      breakpointType: breakpointType as 'zone' | 'level' | 'boss' | 'act' | 'lab' | 'custom',
      breakpointName: breakpointName,
      splitTimeMs,
      segmentTimeMs,
      deltaMs: null,
      townTimeMs,
      hideoutTimeMs,
      deathCount,
      bossFightMs,
    });

    // Check if next breakpoint needs fast polling
    const completedSplitNames = new Set(timer.splits.map(s => s.name));
    completedSplitNames.add(breakpointName);
    updatePollingSpeed(completedSplitNames);

    // Send to backend with snapshot capture request
    if (currentRun?.id) {
      try {
        await invoke('add_split', {
          request: {
            split: {
              runId: currentRun.id,
              breakpointType: breakpointType,
              breakpointName: breakpointName,
              splitTimeMs: splitTimeMs,
              deltaMs: null,
              segmentTimeMs: segmentTimeMs,
              townTimeMs: townTimeMs,
              hideoutTimeMs: hideoutTimeMs,
              deathCount: deathCount,
              bossFightMs: bossFightMs,
            },
            capture_snapshot: shouldCaptureSnapshot,
            account_name: accountName || null,
            character_name: characterName || null,
          },
        });
      } catch (error) {
        console.error('[useTauriEvents] Failed to add split to backend:', error);
      }

      // Auto-end the run if this was the last enabled breakpoint
      const hasRemaining = breakpoints.some(bp =>
        bp.isEnabled && !completedSplitNames.has(bp.name)
      );
      if (!hasRemaining) {
        // Disable fast polling
        invoke('set_log_poll_fast', { enabled: false }).catch(() => {});

        // Complete run in database with the accurate split time
        try {
          await invoke('complete_run', {
            runId: currentRun.id,
            totalTimeMs: splitTimeMs,
          });
        } catch (error) {
          console.error('[useTauriEvents] Failed to auto-complete run:', error);
        }

        // Update local state: sync elapsed time then either enter endgame or end run
        useRunStore.getState().updateElapsed(splitTimeMs);

        // Only enter endgame after Act 10 Kitava kill (not Act 5 or other run endings)
        const { endgameEnabled } = useSettingsStore.getState();
        const lastBp = breakpoints.find(bp => bp.name === breakpointName);
        const isAct10Kitava = lastBp?.trigger.type === 'kitava' && lastBp?.trigger.act === 10;
        if (endgameEnabled && isAct10Kitava) {
          useRunStore.getState().enterEndgame(splitTimeMs);
        } else {
          useRunStore.getState().endRun();
        }

        // Reload PB/gold splits so next run shows updated comparisons
        useRunStore.getState().loadPbAndGoldSplits();
      }
    }
  }, [addSplit, updatePollingSpeed]);

  // Check if a zone matches the NEXT expected breakpoint (sequential matching)
  const checkZoneBreakpoint = useCallback((zoneName: string) => {
    const { breakpoints } = useSettingsStore.getState();
    const { timer } = useRunStore.getState();
    // Get list of already completed split names
    const completedSplits = new Set(timer.splits.map(s => s.name));

    // Find the next enabled zone breakpoint that hasn't been completed yet
    for (const bp of breakpoints) {
      if (!bp.isEnabled) continue;
      if (bp.trigger.type !== 'zone') continue;
      if (completedSplits.has(bp.name)) continue; // Skip already completed

      // This is the next expected breakpoint - check if it matches
      if (bp.trigger.zoneName?.toLowerCase() === zoneName.toLowerCase()) {
        triggerSplit(bp.name, bp.type);
        return;
      } else {
        // The next expected breakpoint doesn't match this zone, so don't trigger anything
        // This prevents skipping ahead (e.g., triggering Act 6 when still in Act 1)
        return;
      }
    }
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

  // Check if a Kitava affliction matches the next expected kitava breakpoint (sequential matching)
  const checkKitavaBreakpoint = useCallback((penalty: number) => {
    const { breakpoints } = useSettingsStore.getState();
    const { timer } = useRunStore.getState();
    const completedSplits = new Set(timer.splits.map(s => s.name));

    for (const bp of breakpoints) {
      if (!bp.isEnabled) continue;
      if (bp.trigger.type !== 'kitava') continue;
      if (completedSplits.has(bp.name)) continue;

      if (bp.trigger.penalty === penalty) {
        triggerSplit(bp.name, bp.type);
        return;
      } else {
        return;
      }
    }
  }, [triggerSplit]);

  // Handle log events
  const handleLogEvent = useCallback((payload: LogEventPayload) => {
    const { event_type } = payload;
    const { timer } = useRunStore.getState();

    switch (event_type) {
      case 'zone_enter':
        if (payload.zone_name) {
          // Track zone for town/hideout time calculation
          const { enterZone } = useRunStore.getState();
          const isTown = isTownZone(payload.zone_name);
          const isHideout = isHideoutZone(payload.zone_name);
          enterZone(payload.zone_name, isTown, isHideout);

          // Forward zone events to practice mode
          const practiceState = usePracticeStore.getState();
          if (practiceState.isActive) {
            practiceState.handleZoneEnter(payload.zone_name);
          }

          checkZoneBreakpoint(payload.zone_name);

          // Trigger group character detection on The Coast entry
          if (payload.zone_name.toLowerCase() === 'the coast') {
            const { groupModeEnabled } = useSettingsStore.getState();
            const { currentRun } = useRunStore.getState();
            if (groupModeEnabled && currentRun?.isGroupRun) {
              const league = currentRun.league || '';
              invoke('detect_group_characters', { league }).catch((err) => {
                console.error('[useTauriEvents] Group character detection failed:', err);
              });
            }
          }
        }
        break;

      case 'level_up':
        if (payload.level) {
          // Track current level
          useRunStore.getState().setCurrentLevel(payload.level);

          // Auto-detect character name from level-up event
          if (payload.character_name) {
            const { currentRun } = useRunStore.getState();
            const { testCharacterName } = useSettingsStore.getState();
            const currentChar = currentRun?.characterName || currentRun?.character;
            // Update if no character, unknown, still using the test/placeholder name,
            // or this is a level 2 event (supports muling: mule hits level 2 first,
            // then the real character's level 2 overwrites it)
            const shouldUpdate = !currentChar || currentChar === 'Unknown' || currentChar === testCharacterName || payload.level <= 2;
            if (currentRun && shouldUpdate) {
              const newCharName = payload.character_name;
              const newClass = payload.character_class || currentRun.class;

              // Update local state
              useRunStore.setState({
                currentRun: {
                  ...currentRun,
                  character: newCharName,
                  characterName: newCharName,
                  class: newClass,
                },
              });

              // Update database record
              if (currentRun.id) {
                invoke('update_run_character', {
                  runId: currentRun.id,
                  characterName: newCharName,
                  class: newClass,
                }).catch((err) => {
                  console.error('[useTauriEvents] Failed to update run character in database:', err);
                });
              }
            }
          }

          checkLevelBreakpoint(payload.level);
        }
        break;

      case 'kitava_affliction':
        if (payload.penalty) {
          checkKitavaBreakpoint(payload.penalty);
        }
        break;

      case 'death':
        if (timer.isRunning) {
          const { incrementDeathCount } = useRunStore.getState();
          incrementDeathCount();
        }
        // Also track deaths in practice mode
        {
          const practice = usePracticeStore.getState();
          if (practice.isActive && practice.timer.isRunning) {
            practice.incrementDeathCount();
          }
        }
        break;

      case 'npc_dialog':
        if (payload.npc_name && timer.isRunning) {
          const boss = getBossFromDialog(payload.npc_name, timer.currentZone, payload.dialog_text);
          if (boss) {
            const { startBossEncounter } = useRunStore.getState();
            startBossEncounter(boss);
          }
        }
        break;

      case 'generating_level':
        if (payload.seed != null) {
          useRunStore.getState().setLatestSeed(payload.seed, payload.level);
        }
        break;

      case 'login':
        break;

      default:
        break;
    }
  }, [checkZoneBreakpoint, checkLevelBreakpoint, checkKitavaBreakpoint]);

  useEffect(() => {
    // Listen for log events from the Rust backend
    const unlistenLogEvent = listen<LogEventPayload>('log-event', (event) => {
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
      addPendingCapture(event.payload.split_id);
    });

    const unlistenSnapshotComplete = listen<SnapshotCompletePayload>('snapshot-complete', async (event) => {
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
      console.error('[useTauriEvents] Snapshot failed for split', event.payload.split_id, '- Error:', event.payload.error);
      addFailedCapture(event.payload.split_id, event.payload.error);
    });

    // Group mode event listeners
    const unlistenGroupMemberDetected = listen<{
      memberId: number;
      accountName: string;
      characterName: string;
      characterClass?: string;
      characterLevel?: number;
      characterLeague?: string;
      characterExperience?: number;
    }>('group-member-character-detected', (event) => {
      const { handleMemberDetected } = useGroupStore.getState();
      const p = event.payload;
      const info = p.characterClass ? {
        characterClass: p.characterClass,
        characterLevel: p.characterLevel ?? 1,
        characterLeague: p.characterLeague ?? '',
        characterExperience: p.characterExperience ?? 0,
      } : undefined;
      handleMemberDetected(p.memberId, p.characterName, info);
    });

    const unlistenGroupMemberFailed = listen<{
      memberId: number;
      accountName: string;
      reason: string;
    }>('group-member-detection-failed', (event) => {
      const { setDetectionStatus, setIsDetecting } = useGroupStore.getState();
      setDetectionStatus(event.payload.memberId, 'failed');
      console.warn('[useTauriEvents] Group member detection failed:', event.payload.accountName, event.payload.reason);
      // Check if all detections are done
      const { members, detectionStatus } = useGroupStore.getState();
      const activeMembers = members.filter(m => m.isActive);
      const allDone = activeMembers.every(m =>
        m.characterName || detectionStatus[m.id] === 'resolved' || detectionStatus[m.id] === 'failed'
      );
      if (allDone) setIsDetecting(false);
    });

    const unlistenGroupSnapshotComplete = listen<{
      splitId: number;
      runId: number;
    }>('group-snapshot-complete', (event) => {
      const { currentRun } = useRunStore.getState();
      if (currentRun && currentRun.id === event.payload.runId) {
        useGroupStore.getState().loadGroupSnapshots(event.payload.runId);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      unlistenLogEvent.then((fn) => fn());
      unlistenSettings.then((fn) => fn());
      unlistenSplit.then((fn) => fn());
      unlistenSnapshotCapturing.then((fn) => fn());
      unlistenSnapshotComplete.then((fn) => fn());
      unlistenSnapshotFailed.then((fn) => fn());
      unlistenGroupMemberDetected.then((fn) => fn());
      unlistenGroupMemberFailed.then((fn) => fn());
      unlistenGroupSnapshotComplete.then((fn) => fn());
    };
  }, [handleLogEvent, loadSettings, triggerSplit, addPendingCapture, addSnapshot, addFailedCapture]);
}
