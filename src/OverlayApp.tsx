import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { OverlayTimer } from './components/Overlay/OverlayTimer';
import { OverlayZone } from './components/Overlay/OverlayZone';
import { OverlaySplit } from './components/Overlay/OverlaySplit';
import { OverlayBreakpoints } from './components/Overlay/OverlayBreakpoints';

interface OverlayState {
  elapsedMs: number;
  isRunning: boolean;
  currentZone: string | null;
  lastSplit: {
    name: string;
    deltaMs: number | null;
    isBestSegment: boolean;
  } | null;
  upcomingBreakpoints: string[];
  opacity: number;
}

const initialState: OverlayState = {
  elapsedMs: 0,
  isRunning: false,
  currentZone: null,
  lastSplit: null,
  upcomingBreakpoints: [],
  opacity: 0.8,
};

// Simple debounce helper
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function OverlayApp() {
  const [state, setState] = useState<OverlayState>(initialState);
  const [isLocked, setIsLocked] = useState(false);

  // Listen for state updates from main window
  useEffect(() => {
    const unlistenState = listen<OverlayState>('overlay-state-update', (event) => {
      setState(event.payload);
    });

    return () => {
      unlistenState.then((fn) => fn());
    };
  }, []);

  // Listen for lock toggle from global shortcut
  useEffect(() => {
    const unlistenLock = listen<string>('global-shortcut', async (event) => {
      if (event.payload === 'toggle-overlay-lock') {
        const newLocked = !isLocked;
        setIsLocked(newLocked);
        try {
          await getCurrentWindow().setIgnoreCursorEvents(newLocked);
        } catch (error) {
          console.error('Failed to set cursor events:', error);
        }
      }
    });

    return () => {
      unlistenLock.then((fn) => fn());
    };
  }, [isLocked]);

  // Save position when window moves
  useEffect(() => {
    const savePositionDebounced = debounce(async () => {
      try {
        const position = await getCurrentWindow().outerPosition();
        await invoke('set_overlay_position', { x: position.x, y: position.y });
      } catch (error) {
        console.error('Failed to save position:', error);
      }
    }, 500);

    const unlistenMove = getCurrentWindow().onMoved(() => {
      savePositionDebounced();
    });

    return () => {
      unlistenMove.then((fn) => fn());
    };
  }, []);

  // Handle dragging
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    // Only allow drag from the main container, not buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    if (isLocked) return;

    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error('Failed to start dragging:', error);
    }
  }, [isLocked]);

  // Toggle lock
  const handleToggleLock = useCallback(async () => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    try {
      await getCurrentWindow().setIgnoreCursorEvents(newLocked);
    } catch (error) {
      console.error('Failed to set cursor events:', error);
    }
  }, [isLocked]);

  // Close overlay
  const handleClose = useCallback(async () => {
    try {
      await invoke('close_overlay');
    } catch (error) {
      console.error('Failed to close overlay:', error);
    }
  }, []);

  return (
    <div
      className={`w-full h-full rounded-lg overflow-hidden ${isLocked ? '' : 'drag-handle'}`}
      style={{
        backgroundColor: `rgba(5, 5, 6, ${state.opacity})`,
        border: isLocked
          ? '1px solid rgba(100, 100, 100, 0.3)'
          : '1px solid rgba(175, 96, 37, 0.5)',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header with controls */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-[--color-border]">
        <span className="text-xs text-[--color-poe-gold] font-semibold">
          {isLocked ? 'Locked (Ctrl+Shift+O)' : 'POE Watcher'}
        </span>
        <div className="flex items-center gap-1">
          {/* Lock button */}
          <button
            onClick={handleToggleLock}
            className={`p-1 transition-colors ${
              isLocked
                ? 'text-yellow-400 hover:text-yellow-300'
                : 'text-[--color-text-muted] hover:text-[--color-text]'
            }`}
            title={isLocked ? 'Unlock overlay (Ctrl+Shift+O)' : 'Lock overlay (Ctrl+Shift+O)'}
          >
            {isLocked ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>
              </svg>
            )}
          </button>
          {/* Close button */}
          <button
            onClick={handleClose}
            className="text-[--color-text-muted] hover:text-[--color-text] p-1"
            title="Close overlay (Ctrl+O)"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Timer */}
        <OverlayTimer elapsedMs={state.elapsedMs} isRunning={state.isRunning} />

        {/* Current zone */}
        <OverlayZone zoneName={state.currentZone} />

        {/* Last split */}
        {state.lastSplit && (
          <OverlaySplit
            name={state.lastSplit.name}
            deltaMs={state.lastSplit.deltaMs}
            isBestSegment={state.lastSplit.isBestSegment}
          />
        )}

        {/* Upcoming breakpoints */}
        {state.upcomingBreakpoints.length > 0 && (
          <OverlayBreakpoints breakpoints={state.upcomingBreakpoints} />
        )}
      </div>
    </div>
  );
}
