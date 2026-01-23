import { invoke } from '@tauri-apps/api/core';
import { useRunStore } from '../../stores/runStore';

export function TimerControls() {
  const { timer, currentRun, startTimer, stopTimer, resetRun, endRun } = useRunStore();

  const handleStart = () => {
    startTimer();
  };

  const handlePause = () => {
    stopTimer();
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the current run?')) {
      resetRun();
    }
  };

  const handleEnd = () => {
    if (confirm('End and save the current run?')) {
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
    <div className="flex gap-3">
      {!timer.isRunning ? (
        <button
          onClick={handleStart}
          className="flex-1 py-3 px-6 bg-[--color-timer-ahead] text-white font-semibold rounded-lg
                     hover:bg-green-600 transition-colors"
        >
          {timer.elapsedMs > 0 ? 'Resume' : 'Start'}
        </button>
      ) : (
        <button
          onClick={handlePause}
          className="flex-1 py-3 px-6 bg-[--color-poe-gold] text-[--color-poe-darker] font-semibold rounded-lg
                     hover:bg-[--color-poe-gold-light] transition-colors"
        >
          Pause
        </button>
      )}

      <button
        onClick={handleManualSplit}
        disabled={!timer.isRunning}
        className="py-3 px-6 bg-[--color-surface-elevated] text-[--color-text] font-semibold rounded-lg
                   hover:bg-[--color-border] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Split
      </button>

      {currentRun && (
        <button
          onClick={handleEnd}
          className="py-3 px-6 bg-[--color-poe-gem] text-white font-semibold rounded-lg
                     hover:bg-teal-600 transition-colors"
        >
          End Run
        </button>
      )}

      <button
        onClick={handleReset}
        disabled={timer.elapsedMs === 0}
        className="py-3 px-6 bg-[--color-timer-behind] text-white font-semibold rounded-lg
                   hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Reset
      </button>
    </div>
  );
}
