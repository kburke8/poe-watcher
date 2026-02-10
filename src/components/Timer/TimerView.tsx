import { useEffect, useRef } from 'react';
import { useRunStore } from '../../stores/runStore';
import { TimerDisplay } from './TimerDisplay';
import { TimerControls } from './TimerControls';
import { SplitList } from '../Splits/SplitList';
import type { TimerState } from '../../types';

export function TimerView() {
  const { timer, updateElapsed, currentRun } = useRunStore();
  const animationRef = useRef<number | null>(null);

  // Update timer every frame when running
  useEffect(() => {
    const updateTimer = () => {
      if (timer.isRunning && timer.startTime) {
        updateElapsed(Date.now() - timer.startTime);
      }
      animationRef.current = requestAnimationFrame(updateTimer);
    };

    if (timer.isRunning) {
      animationRef.current = requestAnimationFrame(updateTimer);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [timer.isRunning, timer.startTime, updateElapsed]);

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text]">Speedrun Timer</h1>
          {currentRun && (
            <p className="text-[--color-text-muted] mt-1">
              {currentRun.characterName} - {currentRun.class} ({currentRun.league})
            </p>
          )}
        </div>
      </div>

      {/* Main timer area */}
      <div className="flex-1 flex gap-6">
        {/* Left side - Timer and controls */}
        <div className="flex-1 flex flex-col">
          <div className="bg-[--color-surface] rounded-lg p-8 mb-6">
            <TimerDisplay elapsedMs={timer.elapsedMs} />

            {/* Current segment */}
            {timer.splits.length > 0 && (
              <div className="mt-4 text-center">
                <span className="text-[--color-text-muted] text-sm">Segment: </span>
                <span className="timer-display text-lg text-[--color-text]">
                  {formatTime(timer.elapsedMs - timer.splits[timer.splits.length - 1].splitTimeMs)}
                </span>
              </div>
            )}

            {/* Zone and Town/Hideout Time */}
            <div className="mt-4 pt-4 border-t border-[--color-border]">
              <div className="flex justify-between text-sm mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[--color-text-muted]">Zone:</span>
                  <span className={`text-[--color-text] ${timer.inTown ? 'text-yellow-400' : ''} ${timer.inHideout ? 'text-blue-400' : ''}`}>
                    {timer.currentZone || 'None'}
                    {timer.inTown && ' (Town)'}
                    {timer.inHideout && ' (Hideout)'}
                  </span>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400/70">Town:</span>
                  <span className="timer-display text-[--color-text]">
                    {formatTime(getCurrentTownTime(timer))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400/70">Hideout:</span>
                  <span className="timer-display text-[--color-text]">
                    {formatTime(getCurrentHideoutTime(timer))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <TimerControls />

          {/* Run info panel */}
          {!currentRun && (
            <div className="mt-6 bg-[--color-surface] rounded-lg p-6">
              <h3 className="text-lg font-semibold text-[--color-text] mb-3">Start a Run</h3>
              <p className="text-[--color-text-muted] text-sm mb-4">
                Configure your POE log path in Settings, then start a new character or zone into the game.
                The timer will automatically detect your character and begin tracking.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-[--color-surface-elevated] rounded text-xs text-[--color-text-muted]">
                  Auto-detect enabled
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right side - Splits */}
        <div className="w-80">
          <SplitList />
        </div>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// Calculate current town time including time currently in town
function getCurrentTownTime(timer: TimerState): number {
  let total = timer.townTimeMs;
  if (timer.inTown && timer.townEnteredAt !== null) {
    total += Date.now() - timer.townEnteredAt;
  }
  return total;
}

// Calculate current hideout time including time currently in hideout
function getCurrentHideoutTime(timer: TimerState): number {
  let total = timer.hideoutTimeMs;
  if (timer.inHideout && timer.hideoutEnteredAt !== null) {
    total += Date.now() - timer.hideoutEnteredAt;
  }
  return total;
}
