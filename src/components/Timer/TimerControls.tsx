import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { Play, Pause, SplitSquareHorizontal, Camera, Flag, RotateCcw } from 'lucide-react';
import { useRunStore } from '../../stores/runStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Button } from '../Shared/Button';

export function TimerControls() {
  const { timer, currentRun, startTimer, stopTimer, resetRun, endRun, setRunId } = useRunStore();
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

  const handleReset = () => {
    resetRun();
  };

  const handleEnd = async () => {
    const state = useRunStore.getState();
    const run = state.currentRun;
    const { timer: t } = state;

    // Skip if run was already auto-completed (e.g. last split triggered auto-end)
    if (run?.isCompleted) {
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
        const splitName = t.currentZone || 'End Run';
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

      // Complete the run in the database
      try {
        await invoke<boolean>('complete_run', {
          runId: run.id,
          totalTimeMs,
        });
      } catch (error) {
        console.error('[TimerControls] Failed to complete run in database:', error);
      }
    }

    endRun();

    // Reload PB/gold splits so next run shows updated comparisons
    useRunStore.getState().loadPbAndGoldSplits();
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
        disabled={!currentRun || currentRun.isCompleted}
        style={currentRun && !currentRun.isCompleted ? { background: 'linear-gradient(180deg, #22b09a 0%, #147868 100%)', borderColor: '#2ac0a8', color: 'white', boxShadow: '0 0 10px rgba(27, 162, 155, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)' } : undefined}
      >
        End Run
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
      </div>
      <div className="text-center text-xs text-[--color-text-muted]">
        Hotkey: <kbd>{hotkeys.toggleTimer}</kbd> to start/pause
      </div>
    </div>
  );
}
