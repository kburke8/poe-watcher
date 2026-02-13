import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { useRunStore } from '../../stores/runStore';
import { useSettingsStore } from '../../stores/settingsStore';

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
            league: run.league || 'Standard',
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
        <button
          onClick={handleStart}
          className="flex-1 py-3 px-6 bg-[--color-timer-ahead] text-white font-semibold rounded-lg
                     border border-green-400 shadow-md
                     hover:bg-green-600 hover:shadow-lg active:scale-95 active:shadow-sm transition-all duration-100"
          title={hotkeys.toggleTimer}
        >
          {timer.elapsedMs > 0 ? 'Resume' : 'Start'}
        </button>
      ) : (
        <button
          onClick={handlePause}
          className="flex-1 py-3 px-6 bg-[--color-poe-gold] text-[--color-poe-darker] font-semibold rounded-lg
                     border border-[--color-poe-gold-light] shadow-md
                     hover:bg-[--color-poe-gold-light] hover:shadow-lg active:scale-95 active:shadow-sm transition-all duration-100"
          title={hotkeys.toggleTimer}
        >
          Pause
        </button>
      )}

      <button
        onClick={handleManualSplit}
        disabled={!timer.isRunning}
        className="py-3 px-6 bg-[--color-surface] text-[--color-text] font-semibold rounded-lg
                   border-2 border-[--color-poe-gold]/40 shadow-md
                   hover:border-[--color-poe-gold]/70 hover:shadow-lg active:scale-95 active:shadow-sm transition-all duration-100
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none disabled:border-[--color-border]"
        title={hotkeys.manualSplit}
      >
        Split
      </button>

      {currentRun && (
        <button
          onClick={handleManualSnapshot}
          disabled={!accountName}
          className="py-3 px-6 bg-[--color-surface] text-[--color-text] font-semibold rounded-lg
                     border-2 border-purple-500/40 shadow-md
                     hover:border-purple-500/70 hover:shadow-lg active:scale-95 active:shadow-sm transition-all duration-100
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none disabled:border-[--color-border]"
          title={hotkeys.manualSnapshot}
        >
          Snapshot
        </button>
      )}

      {currentRun && (
        <button
          onClick={handleEnd}
          className="py-3 px-6 bg-[--color-poe-gem] text-white font-semibold rounded-lg
                     border border-teal-400 shadow-md
                     hover:bg-teal-600 hover:shadow-lg active:scale-95 active:shadow-sm transition-all duration-100"
        >
          End Run
        </button>
      )}

      <button
        onClick={handleReset}
        disabled={timer.elapsedMs === 0}
        className="py-3 px-6 bg-[--color-timer-behind] text-white font-semibold rounded-lg
                   border border-red-400 shadow-md
                   hover:bg-red-600 hover:shadow-lg active:scale-95 active:shadow-sm transition-all duration-100
                   disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none"
      >
        Reset
      </button>
      </div>
      <div className="text-center text-xs text-[--color-text-muted]">
        Hotkey: <kbd className="px-1.5 py-0.5 bg-[--color-surface-elevated] rounded text-[--color-text]">{hotkeys.toggleTimer}</kbd> to start/pause
      </div>
    </div>
  );
}
