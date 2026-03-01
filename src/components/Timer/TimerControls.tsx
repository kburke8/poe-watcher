import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { Play, Pause, SplitSquareHorizontal, Camera, Flag, RotateCcw, Zap } from 'lucide-react';
import { useRunStore } from '../../stores/runStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useGroupStore } from '../../stores/groupStore';
import { Button } from '../Shared/Button';

export function TimerControls() {
  const { timer, currentRun, startTimer, stopTimer, resetRun, abandonRun, setRunId } = useRunStore();
  const { accountName, testCharacterName, hotkeys } = useSettingsStore();

  const handleStart = async () => {
    // Start the timer (creates local run state)
    startTimer();

    // Get the current run state (just created by startTimer)
    const state = useRunStore.getState();
    const run = state.currentRun;

    // If this is a fresh start (not a resume), create the run in the database
    if (run && timer.elapsedMs === 0) {
      try {
        // Get breakpoint preset info
        const presetName = useSettingsStore.getState().getCurrentPresetName();
        const enabledBreakpoints = useSettingsStore.getState().getEnabledBreakpointNames();

        const { groupModeEnabled } = useSettingsStore.getState();

        const dbRunId = await invoke<number>('create_run', {
          run: {
            characterName: run.characterName || run.character || testCharacterName || 'Unknown',
            accountName: accountName || '',
            class: run.class || 'Unknown',
            ascendancy: run.ascendancy || null,
            league: run.league || '',
            category: run.category || 'any%',
            startedAt: run.startedAt || new Date().toISOString(),
            breakpointPreset: presetName,
            enabledBreakpoints: JSON.stringify(enabledBreakpoints),
            isGroupRun: groupModeEnabled,
          },
        });
        setRunId(dbRunId);
      } catch (error) {
        console.error('[TimerControls] Failed to create run in database:', error);
      }
    }
  };

  const handlePause = () => {
    stopTimer();
  };

  const handleReset = async () => {
    // Abandon the run in the database if it exists and isn't already completed
    const state = useRunStore.getState();
    const run = state.currentRun;
    if (run?.id && run.status !== 'completed') {
      const { timer: t } = state;
      const totalTimeMs = t.isRunning && t.startTime
        ? Date.now() - t.startTime
        : t.elapsedMs;
      try {
        await invoke('abandon_run', { runId: run.id, totalTimeMs });
      } catch (error) {
        console.error('[TimerControls] Failed to abandon run:', error);
      }
    }
    // Clear group member character names so they get re-detected next run
    const { groupModeEnabled } = useSettingsStore.getState();
    if (groupModeEnabled) {
      useGroupStore.getState().clearCharacterNames();
    }

    resetRun();
  };

  const handleEnd = async () => {
    const state = useRunStore.getState();
    const run = state.currentRun;
    const { timer: t } = state;

    // Skip if run was already auto-completed (e.g. last split triggered auto-end)
    if (run?.status === 'completed') {
      resetRun();
      return;
    }

    // Calculate actual elapsed time (works whether running or paused)
    const totalTimeMs = t.isRunning && t.startTime
      ? Date.now() - t.startTime
      : t.elapsedMs;

    // Capture an end-of-run snapshot named after the current zone
    if (run?.id) {
      const { accountName: acct, testCharacterName: testChar } = useSettingsStore.getState();
      const detectedChar = run.characterName || run.character;
      const charName = (detectedChar && detectedChar !== 'Unknown') ? detectedChar : testChar;
      const hasValidCapture = acct && charName && charName !== 'Unknown';

      if (hasValidCapture) {
        const splitName = t.currentZone || 'End Early';
        const segmentTimeMs = t.splits.length > 0
          ? totalTimeMs - t.splits[t.splits.length - 1].splitTimeMs
          : totalTimeMs;

        try {
          await invoke('add_split', {
            request: {
              split: {
                runId: run.id,
                breakpointType: 'custom',
                breakpointName: splitName,
                splitTimeMs: totalTimeMs,
                deltaMs: null,
                segmentTimeMs,
                townTimeMs: t.townTimeMs,
                hideoutTimeMs: t.hideoutTimeMs,
                deathCount: t.deathCount,
              },
              capture_snapshot: true,
              account_name: acct,
              character_name: charName,
            },
          });
        } catch (error) {
          console.error('[TimerControls] Failed to capture end-run snapshot:', error);
        }
      }

      // Abandon the run in the database (not a natural completion)
      try {
        await invoke('abandon_run', {
          runId: run.id,
          totalTimeMs,
        });
      } catch (error) {
        console.error('[TimerControls] Failed to abandon run in database:', error);
      }
    }

    abandonRun();
  };

  const handleManualSplit = () => {
    if (!timer.isRunning) return;

    const { breakpoints } = useSettingsStore.getState();
    const completedSplits = new Set(timer.splits.map(s => s.name));

    // Find the next enabled breakpoint that hasn't been completed yet
    for (const bp of breakpoints) {
      if (!bp.isEnabled) continue;
      if (completedSplits.has(bp.name)) continue;

      emit('split-trigger', { name: bp.name, type: bp.type });
      return;
    }
  };

  const handleManualSnapshot = async () => {
    const state = useRunStore.getState();
    const run = state.currentRun;
    const { timer: t } = state;
    if (!run?.id) return;

    const { accountName: acct, testCharacterName: testChar } = useSettingsStore.getState();
    const detectedChar = run.characterName || run.character;
    const charName = (detectedChar && detectedChar !== 'Unknown') ? detectedChar : testChar;
    if (!acct || !charName || charName === 'Unknown') return;

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
            runId: run.id,
            breakpointType: 'custom',
            breakpointName: splitName,
            splitTimeMs: elapsedMs,
            deltaMs: null,
            segmentTimeMs,
            townTimeMs: t.townTimeMs,
            hideoutTimeMs: t.hideoutTimeMs,
            deathCount: t.deathCount,
          },
          capture_snapshot: true,
          account_name: acct,
          character_name: charName,
        },
      });
    } catch (error) {
      console.error('[TimerControls] Failed to capture manual snapshot:', error);
    }
  };

  const handleForceEndgame = async () => {
    const state = useRunStore.getState();
    const run = state.currentRun;
    const { timer: t } = state;
    if (!run?.id || !t.isRunning) return;

    const totalTimeMs = t.startTime ? Date.now() - t.startTime : t.elapsedMs;

    // Complete run in database
    try {
      await invoke('complete_run', { runId: run.id, totalTimeMs });
    } catch (error) {
      console.error('[TimerControls] Failed to complete run for endgame:', error);
    }

    useRunStore.getState().updateElapsed(totalTimeMs);
    useRunStore.getState().enterEndgame(totalTimeMs);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
      {!timer.isRunning ? (
        <Button
          variant="primary"
          size="lg"
          icon={Play}
          onClick={handleStart}
          title={hotkeys.toggleTimer}
          className="flex-1"
          style={{ background: 'linear-gradient(180deg, #2cc660 0%, #189845 100%)', borderColor: '#44d070', color: 'white', boxShadow: '0 0 14px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)' }}
        >
          {timer.elapsedMs > 0 ? 'Resume' : 'Start'}
        </Button>
      ) : (
        <Button
          variant="primary"
          size="lg"
          icon={Pause}
          onClick={handlePause}
          title={hotkeys.toggleTimer}
          className="flex-1"
        >
          Pause
        </Button>
      )}

      <Button
        variant="secondary"
        size="lg"
        icon={SplitSquareHorizontal}
        onClick={handleManualSplit}
        disabled={!timer.isRunning}
        title={hotkeys.manualSplit}
      >
        Split
      </Button>

      <Button
        variant="secondary"
        size="lg"
        icon={Camera}
        onClick={handleManualSnapshot}
        disabled={!currentRun || !accountName}
        title={hotkeys.manualSnapshot}
        className="border-purple-500/40 hover:border-purple-500/70"
      >
        Snapshot
      </Button>

      <Button
        variant="secondary"
        size="lg"
        icon={Flag}
        onClick={handleEnd}
        disabled={!currentRun || currentRun.status === 'completed'}
        style={currentRun && currentRun.status !== 'completed' ? { background: 'linear-gradient(180deg, #22b09a 0%, #147868 100%)', borderColor: '#2ac0a8', color: 'white', boxShadow: '0 0 10px rgba(27, 162, 155, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)' } : undefined}
      >
        End Early
      </Button>

      <Button
        variant="destructive"
        size="lg"
        icon={RotateCcw}
        onClick={handleReset}
        disabled={timer.elapsedMs === 0}
      >
        Reset
      </Button>

      {import.meta.env.DEV && (
        <Button
          variant="secondary"
          size="lg"
          icon={Zap}
          onClick={handleForceEndgame}
          disabled={!timer.isRunning || timer.isInEndgame}
          title="Force enter endgame mode (dev only)"
          className="border-yellow-500/40 hover:border-yellow-500/70"
        >
          Endgame
        </Button>
      )}
      </div>
      <div className="text-center text-xs text-[--color-text-muted]">
        Hotkey: <kbd>{hotkeys.toggleTimer}</kbd> to start/pause
      </div>
    </div>
  );
}
