import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Monitor, Play, Pause, Square } from 'lucide-react';
import { useRunStore } from '../../stores/runStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { HelpTip } from '../Shared/HelpTip';
import { TimerDisplay } from '../Timer/TimerDisplay';
import { Button } from '../Shared/Button';
import type { TimerState, CompletedMap } from '../../types';

export function MappingView() {
  const { timer, updateElapsed, startMappingSession, stopMappingSession, startTimer, pauseTimer } = useRunStore();
  const { overlayOpen, overlayEnabled, setOverlayOpen, hotkeys } = useSettingsStore();
  const animationRef = useRef<number | null>(null);
  const mapLogRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll map log to bottom when new maps are added
  useEffect(() => {
    if (mapLogRef.current) {
      mapLogRef.current.scrollTop = mapLogRef.current.scrollHeight;
    }
  }, [timer.completedMaps.length]);

  const isSessionActive = timer.isMappingSession;

  const handleStart = () => {
    if (isSessionActive) {
      // Resume from pause
      startTimer();
    } else {
      // Start new session
      startMappingSession();
    }
  };

  const handlePause = () => {
    pauseTimer();
  };

  const handleEndSession = () => {
    stopMappingSession();
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text] flex items-center gap-2" style={{ textShadow: '0 0 30px rgba(175, 96, 37, 0.2)' }}>
            Mapping Session
            <HelpTip>
              Track your mapping sessions without needing to complete a speedrun first. Start a session and maps will be automatically detected and timed as you play. Session data is ephemeral — it won't be saved to your run history.
            </HelpTip>
          </h1>
          {isSessionActive && (
            <p className="text-[--color-text-muted] mt-1 text-sm">
              Session active — enter maps in-game to start tracking
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

      {/* Main area */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left side - Timer, stats, controls */}
        <div className="flex-1 flex flex-col">
          <div className="card-inset rounded-lg p-8 mb-6">
            <TimerDisplay elapsedMs={timer.elapsedMs} />

            {isSessionActive && (
              <div className="mt-4 pt-4 border-t border-[--color-border]">
                {/* Row 1: Current map zone + live map timer */}
                <div className="flex justify-between text-sm mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[--color-text-muted]">Map:</span>
                    <span className={`text-[--color-text] ${timer.currentMapZone == null ? (timer.inTown ? 'text-yellow-400' : timer.inHideout ? 'text-blue-400' : '') : ''}`}>
                      {timer.currentMapZone || timer.currentZone || 'None'}
                      {timer.currentMapZone != null && timer.currentMapAreaLevel != null && timer.currentMapAreaLevel > 67 && (
                        <span className="text-[--color-text-muted]"> (T{timer.currentMapAreaLevel - 67})</span>
                      )}
                      {timer.currentMapZone == null && timer.inTown && ' (Town)'}
                      {timer.currentMapZone == null && timer.inHideout && ' (Hideout)'}
                    </span>
                  </div>
                  <span className="timer-display text-[--color-text]">
                    {timer.currentMapZone != null
                      ? formatTime(getCurrentMapTime(timer))
                      : '--:--.--'}
                  </span>
                </div>
                {/* Row 2: Town+HO time + Deaths */}
                <div className="flex justify-between text-sm mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400/70">Town+HO:</span>
                    <span className="timer-display text-[--color-text]">
                      {formatTime(getCurrentEndgameTownTime(timer))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={timer.endgameDeathCount > 0 ? 'text-red-400' : 'text-[--color-text-muted]'}>
                      Deaths: {timer.endgameDeathCount}
                    </span>
                  </div>
                </div>
                {/* Row 3: Map count */}
                <div className="flex text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[--color-text-muted]">Maps:</span>
                    <span className="text-[--color-text]">{timer.mapCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              {!isSessionActive ? (
                <Button
                  variant="primary"
                  size="lg"
                  icon={Play}
                  onClick={handleStart}
                  className="flex-1"
                  style={{ background: 'linear-gradient(180deg, #2cc660 0%, #189845 100%)', borderColor: '#44d070', color: 'white', boxShadow: '0 0 14px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)' }}
                >
                  Start Session
                </Button>
              ) : !timer.isRunning ? (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    icon={Play}
                    onClick={handleStart}
                    title={hotkeys.toggleTimer}
                    className="flex-1"
                    style={{ background: 'linear-gradient(180deg, #2cc660 0%, #189845 100%)', borderColor: '#44d070', color: 'white', boxShadow: '0 0 14px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)' }}
                  >
                    Resume
                  </Button>
                  <Button
                    variant="destructive"
                    size="lg"
                    icon={Square}
                    onClick={handleEndSession}
                  >
                    End Session
                  </Button>
                </>
              ) : (
                <>
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
                  <Button
                    variant="destructive"
                    size="lg"
                    icon={Square}
                    onClick={handleEndSession}
                  >
                    End Session
                  </Button>
                </>
              )}
            </div>
            {isSessionActive && (
              <div className="text-center text-xs text-[--color-text-muted]">
                Hotkey: <kbd>{hotkeys.toggleTimer}</kbd> to pause/resume
              </div>
            )}
          </div>

          {/* Instruction card when no session */}
          {!isSessionActive && (
            <div className="mt-6 card-inset rounded-lg p-6">
              <h3 className="text-lg font-semibold text-[--color-text] mb-3">Mapping Session</h3>
              <p className="text-[--color-text-muted] text-sm mb-3">
                Track your mapping sessions independently of speedruns. Start a session, then enter maps in-game — map names, tiers, times, town visits, and deaths will all be tracked automatically.
              </p>
              <p className="text-[--color-text-muted] text-sm">
                Session data is ephemeral and won't appear in your run history. Use <kbd className="px-1.5 py-0.5 bg-[--color-surface-elevated] rounded text-xs font-mono text-[--color-text]">{hotkeys.toggleTimer}</kbd> to pause/resume.
              </p>
            </div>
          )}
        </div>

        {/* Right side - Map log */}
        {isSessionActive && (
          <div className="w-80 flex-shrink-0 flex flex-col min-h-0">
            <MapLog maps={timer.completedMaps} mapLogRef={mapLogRef} />
          </div>
        )}
      </div>
    </div>
  );
}

function MapLog({ maps, mapLogRef }: { maps: CompletedMap[]; mapLogRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-[--color-text-muted] mb-2 uppercase tracking-wider">
        Completed Maps ({maps.length})
      </h3>
      <div
        ref={mapLogRef}
        className="flex-1 overflow-auto card-inset rounded-lg"
      >
        {maps.length === 0 ? (
          <div className="p-4 text-center text-[--color-text-muted] text-sm">
            Maps will appear here as you complete them
          </div>
        ) : (
          <div className="divide-y divide-[--color-border]/50">
            {maps.map((map, i) => (
              <div key={i} className="px-3 py-2 flex items-center gap-2">
                <span className="text-[--color-text-muted] text-xs w-6 text-right flex-shrink-0">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[--color-text] text-sm truncate">
                      {map.zone}
                    </span>
                    {map.areaLevel != null && map.areaLevel > 67 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[--color-surface-elevated] text-[--color-poe-gold] flex-shrink-0">
                        T{map.areaLevel - 67}
                      </span>
                    )}
                  </div>
                </div>
                <span className="timer-display text-sm text-[--color-text] flex-shrink-0">
                  {formatTime(map.timeMs)}
                </span>
              </div>
            ))}
          </div>
        )}
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

function getCurrentMapTime(timer: TimerState): number {
  let total = timer.currentMapElapsedMs;
  if (timer.currentMapEnteredAt !== null && timer.isRunning) {
    total += Date.now() - timer.currentMapEnteredAt;
  }
  return total;
}

function getCurrentEndgameTownTime(timer: TimerState): number {
  let total = timer.endgameTownTimeMs;
  if (timer.inTown && timer.townEnteredAt !== null) {
    total += Date.now() - timer.townEnteredAt;
  }
  if (timer.inHideout && timer.hideoutEnteredAt !== null) {
    total += Date.now() - timer.hideoutEnteredAt;
  }
  return total;
}
