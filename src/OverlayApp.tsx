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

export function OverlayApp() {
  const [state, setState] = useState<OverlayState>(initialState);
  const [isDragging, setIsDragging] = useState(false);

  // Listen for state updates from main window
  useEffect(() => {
    const unlistenState = listen<OverlayState>('overlay-state-update', (event) => {
      setState(event.payload);
    });

    return () => {
      unlistenState.then((fn) => fn());
    };
  }, []);

  // Handle dragging
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    // Only allow drag from the main container, not buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    setIsDragging(true);
    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error('Failed to start dragging:', error);
    }
  }, []);

  // Save position when drag ends
  const handleMouseUp = useCallback(async () => {
    if (isDragging) {
      setIsDragging(false);
      try {
        const position = await getCurrentWindow().outerPosition();
        await invoke('set_overlay_position', { x: position.x, y: position.y });
      } catch (error) {
        console.error('Failed to save position:', error);
      }
    }
  }, [isDragging]);

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
      className="w-full h-full rounded-lg overflow-hidden drag-handle"
      style={{
        backgroundColor: `rgba(5, 5, 6, ${state.opacity})`,
        border: '1px solid rgba(175, 96, 37, 0.5)',
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-[--color-border]">
        <span className="text-xs text-[--color-poe-gold] font-semibold">POE Watcher</span>
        <button
          onClick={handleClose}
          className="text-[--color-text-muted] hover:text-[--color-text] p-1 -mr-1"
          title="Close overlay (Ctrl+O)"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
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
