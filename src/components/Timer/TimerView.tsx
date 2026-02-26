import { useEffect, useRef, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Monitor } from 'lucide-react';
import { useRunStore } from '../../stores/runStore';
import { HelpTip } from '../Shared/HelpTip';
import { useSettingsStore } from '../../stores/settingsStore';
import { TimerDisplay } from './TimerDisplay';
import { TimerControls } from './TimerControls';
import { SplitList } from '../Splits/SplitList';
import { GroupMemberPanels } from './GroupMemberPanels';
import { InlineSnapshotView } from './InlineSnapshotView';
import type { TimerState } from '../../types';

interface SnapshotTarget {
  target: 'player' | number;
  displayName: string;
}

export function TimerView() {
  const { timer, updateElapsed, currentRun } = useRunStore();
  const { overlayOpen, overlayEnabled, setOverlayOpen, hotkeys } = useSettingsStore();
  const animationRef = useRef<number | null>(null);
  const [snapshotTarget, setSnapshotTarget] = useState<SnapshotTarget | null>(null);

  const handleToggleOverlay = useCallback(async () => {
    try {
      const isOpen = await invoke<boolean>('toggle_overlay');
      setOverlayOpen(isOpen);
    } catch (error) {
      console.error('Failed to toggle overlay:', error);
    }
  }, [setOverlayOpen]);

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

  // Clear snapshot view on run reset
  useEffect(() => {
    if (!currentRun) {
      setSnapshotTarget(null);
    }
  }, [currentRun]);

  const handleSelectMember = useCallback((target: 'player' | number, displayName: string) => {
    setSnapshotTarget({ target, displayName });
  }, []);

  const handleBack = useCallback(() => {
    setSnapshotTarget(null);
  }, []);

  // === Snapshot viewing mode ===
  if (snapshotTarget && currentRun) {
    return (
      <div className="h-full flex flex-col p-6">
        {/* Compact header: timer + zone + segment in the top bar */}
        <div className="flex items-center gap-6 mb-4">
          {/* Compact timer */}
          <div className="card-inset rounded-lg px-4 py-2 flex items-center gap-4 flex-shrink-0">
            <span className="timer-display text-2xl text-[--color-text]">
              {formatTime(timer.elapsedMs)}
            </span>
            {timer.splits.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-[--color-text-muted]">Seg:</span>
                <span className="timer-display text-[--color-text]">
                  {formatTime(timer.elapsedMs - timer.splits[timer.splits.length - 1].splitTimeMs)}
                </span>
              </div>
            )}
          </div>

          {/* Zone + town/hideout */}
          <div className="card-inset rounded-lg px-4 py-2 flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-[--color-text-muted]">Zone:</span>
              <span className={`text-[--color-text] ${timer.inTown ? 'text-yellow-400' : ''} ${timer.inHideout ? 'text-blue-400' : ''}`}>
                {timer.currentZone || 'None'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-yellow-400/70">T:</span>
              <span className="timer-display text-[--color-text]">{formatTime(getCurrentTownTime(timer))}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-blue-400/70">H:</span>
              <span className="timer-display text-[--color-text]">{formatTime(getCurrentHideoutTime(timer))}</span>
            </div>
          </div>

          {/* Overlay buttons */}
          <div className="ml-auto flex items-center gap-1.5">
            {overlayEnabled && (
              <button onClick={handleToggleOverlay} className={`p-1.5 rounded-lg border transition-all ${overlayOpen ? 'text-[--color-poe-gold] border-[--color-poe-gold]/60' : 'text-[--color-text-muted] border-[--color-border]'}`}>
                <Monitor className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Party panels - clickable to switch viewed member */}
        {currentRun.isGroupRun && (
          <GroupMemberPanels onSelectMember={handleSelectMember} onBack={handleBack} />
        )}

        {/* Main area: snapshot view + split list */}
        <div className="flex-1 flex gap-6 min-h-0 mt-4">
          <div className="flex-1 min-h-0 overflow-auto">
            <InlineSnapshotView
              target={snapshotTarget.target}
              displayName={snapshotTarget.displayName}
              onBack={handleBack}
            />
          </div>
          <div className="w-80 flex-shrink-0">
            <SplitList />
          </div>
        </div>
      </div>
    );
  }

  // === Normal timer mode ===
  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text] flex items-center gap-2" style={{ textShadow: '0 0 30px rgba(175, 96, 37, 0.2)' }}>
            Speedrun Timer
            <HelpTip>
              Your main speedrun timer with live splits, zone tracking, and PB comparison. Start a run, and splits trigger automatically as you hit breakpoints. Use Ctrl+Space to start/pause, or configure hotkeys in Settings.
            </HelpTip>
          </h1>
          {currentRun && (
            <p className="text-[--color-text-muted] mt-1">
              {currentRun.characterName} - {currentRun.class} ({currentRun.league})
            </p>
          )}
        </div>
        {overlayEnabled && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleOverlay}
              className={`p-2 rounded-lg border-2 transition-all active:scale-95 ${
                overlayOpen
                  ? 'text-[--color-poe-gold] border-[--color-poe-gold]/60 bg-[--color-poe-gold]/10'
                  : 'text-[--color-text-muted] border-[--color-border] hover:text-[--color-text] hover:border-[--color-poe-gold]/40'
              }`}
              title={overlayOpen ? `Close Overlay (${hotkeys.toggleOverlay})` : `Open Overlay (${hotkeys.toggleOverlay})`}
            >
              <Monitor className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      {/* Main timer area */}
      <div className="flex-1 flex gap-6">
        {/* Left side - Timer and controls */}
        <div className="flex-1 flex flex-col">
          <div className="card-inset rounded-lg p-8 mb-6">
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

          {/* Run info panel or group member panels */}
          {!currentRun ? (
            <div className="mt-6 card-inset rounded-lg p-6">
              <h3 className="text-lg font-semibold text-[--color-text] mb-3">Start a Run</h3>
              <p className="text-[--color-text-muted] text-sm mb-4">
                Configure your PoE log path in Settings, then start a new character or zone into the game.
                The timer will automatically detect your character and begin tracking.
              </p>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-[--color-surface-elevated] rounded text-xs text-[--color-text-muted]">
                  Auto-detect enabled
                </span>
              </div>
            </div>
          ) : currentRun.isGroupRun ? (
            <GroupMemberPanels onSelectMember={handleSelectMember} />
          ) : null}
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
