import { invoke } from '@tauri-apps/api/core';
import { useRunStore } from '../../stores/runStore';
import { useSettingsStore } from '../../stores/settingsStore';

export function TimerControls() {
  const { timer, currentRun, startTimer, stopTimer, resetRun, endRun, setRunId } = useRunStore();
  const { accountName } = useSettingsStore();

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
            character_name: run.characterName || run.character || 'Unknown',
            account_name: accountName || '',
            class: run.class || 'Unknown',
            ascendancy: run.ascendancy || null,
            league: run.league || 'Standard',
            category: run.category || 'any%',
            started_at: run.startedAt || new Date().toISOString(),
            breakpoint_preset: presetName,
            enabled_breakpoints: JSON.stringify(enabledBreakpoints),
          },
        });
        console.log('[TimerControls] Run created in database with ID:', dbRunId, 'preset:', presetName);
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
    if (confirm('Are you sure you want to reset the current run?')) {
      resetRun();
    }
  };

  const handleEnd = async () => {
    if (confirm('End and save the current run?')) {
      const state = useRunStore.getState();
      const run = state.currentRun;
      const totalTimeMs = state.timer.elapsedMs;

      // Complete the run in the database if it has a valid ID
      if (run?.id) {
        try {
          const isPb = await invoke<boolean>('complete_run', {
            runId: run.id,
            totalTimeMs,
          });
          console.log('[TimerControls] Run completed in database, isPB:', isPb);
        } catch (error) {
          console.error('[TimerControls] Failed to complete run in database:', error);
        }
      }

      endRun();
    }
  };

  const handleManualSplit = async () => {
    // Trigger a manual split
    try {
      await invoke('manual_split');
    } catch (error) {
      console.error('Failed to trigger manual split:', error);
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
          title="Ctrl+Space"
        >
          {timer.elapsedMs > 0 ? 'Resume' : 'Start'}
        </button>
      ) : (
        <button
          onClick={handlePause}
          className="flex-1 py-3 px-6 bg-[--color-poe-gold] text-[--color-poe-darker] font-semibold rounded-lg
                     border border-[--color-poe-gold-light] shadow-md
                     hover:bg-[--color-poe-gold-light] hover:shadow-lg active:scale-95 active:shadow-sm transition-all duration-100"
          title="Ctrl+Space"
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
      >
        Split
      </button>

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
        Hotkey: <kbd className="px-1.5 py-0.5 bg-[--color-surface-elevated] rounded text-[--color-text]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-[--color-surface-elevated] rounded text-[--color-text]">Space</kbd> to start/pause
      </div>
    </div>
  );
}
