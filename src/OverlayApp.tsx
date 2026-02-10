import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { OverlayTimer } from './components/Overlay/OverlayTimer';
import { OverlayZone } from './components/Overlay/OverlayZone';
import { OverlaySplit } from './components/Overlay/OverlaySplit';
import { OverlayBreakpoints } from './components/Overlay/OverlayBreakpoints';

interface OverlayState {
  startTime: number | null;
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
  startTime: null,
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

  // Ensure cursor events are enabled on mount (transparent windows on Windows may default to click-through)
  useEffect(() => {
    getCurrentWindow().setIgnoreCursorEvents(false);
  }, []);

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

  // Handle dragging (fallback for platforms where -webkit-app-region doesn't work)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (isLocked) return;
    e.preventDefault();
    getCurrentWindow().startDragging();
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
        backgroundColor: '#0c0c0e',
        border: isLocked
          ? '2px solid #3a3a3e'
          : '2px solid #af6025',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.8)',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header with controls */}
      <div className="flex items-center justify-between px-3 py-1" style={{ borderBottom: '1px solid #3a3a3e' }}>
        <span className="text-xs font-semibold" style={{ color: '#af6025' }}>
          {isLocked ? 'Locked (Ctrl+Shift+O)' : 'POE Watcher'}
        </span>
        <div className="flex items-center gap-1">
          {/* Lock button */}
          <button
            onClick={handleToggleLock}
            className="p-1"
            style={{ color: isLocked ? '#fbbf24' : '#9ca3af' }}
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
            className="p-1"
            style={{ color: '#9ca3af' }}
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
        <OverlayTimer startTime={state.startTime} elapsedMs={state.elapsedMs} isRunning={state.isRunning} />

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
