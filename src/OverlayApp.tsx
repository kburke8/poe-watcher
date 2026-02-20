import { useState, useEffect, useCallback, useRef } from 'react';
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
    splitTimeMs?: number;
    segmentTimeMs?: number;
    pbSegmentTimeMs?: number | null;
    goldSegmentTimeMs?: number | null;
  } | null;
  upcomingBreakpoints: { name: string; pbTimeMs: number | null; pbSegmentTimeMs: number | null }[];
  opacity: number;
  // Display config
  scale?: 'small' | 'medium' | 'large';
  fontSize?: 'small' | 'medium' | 'large';
  showTimer?: boolean;
  showZone?: boolean;
  showLastSplit?: boolean;
  showBreakpoints?: boolean;
  breakpointCount?: number;
  bgOpacity?: number;
  accentColor?: string;
  alwaysOnTop?: boolean;
  isLocked?: boolean;
  // Hotkey labels
  hotkeyToggleTimer?: string;
  hotkeyToggleOverlay?: string;
  hotkeyToggleOverlayLock?: string;
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
  const prevScaleRef = useRef<string | undefined>(undefined);

  // Listen for state updates from main window
  useEffect(() => {
    const unlistenState = listen<OverlayState>('overlay-state-update', (event) => {
      setState(event.payload);
    });

    // Signal to main window that overlay is ready to receive events
    invoke('overlay_ready').catch(() => {});

    return () => {
      unlistenState.then((fn) => fn());
    };
  }, []);

  // Sync lock state from payload
  useEffect(() => {
    if (state.isLocked !== undefined && state.isLocked !== isLocked) {
      setIsLocked(state.isLocked);
      getCurrentWindow().setIgnoreCursorEvents(state.isLocked).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isLocked]);

  // Sync scale changes - resize overlay window
  useEffect(() => {
    if (state.scale && state.scale !== prevScaleRef.current) {
      prevScaleRef.current = state.scale;
      const sizes = { small: [240, 120], medium: [320, 180], large: [420, 240] };
      const [w, h] = sizes[state.scale] || sizes.medium;
      invoke('resize_overlay', { width: w, height: h }).catch(() => {});
    }
  }, [state.scale]);

  // Sync always-on-top changes
  useEffect(() => {
    if (state.alwaysOnTop !== undefined) {
      invoke('set_overlay_always_on_top', { enabled: state.alwaysOnTop }).catch(() => {});
    }
  }, [state.alwaysOnTop]);

  // Listen for lock toggle from global shortcut (click-through mode)
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

  // Ensure cursor events are enabled on mount
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

  // Handle dragging (only when unlocked)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;
    e.preventDefault();
    getCurrentWindow().startDragging();
  }, [isLocked]);

  // Derive display values from config
  const accentColor = state.accentColor || 'transparent';
  const isTransparentAccent = accentColor === 'transparent';
  const bgOpacity = state.bgOpacity ?? 0.9;
  const showTimer = state.showTimer ?? true;
  const showZone = state.showZone ?? true;
  const showLastSplit = state.showLastSplit ?? true;
  const showBreakpoints = state.showBreakpoints ?? true;
  const breakpointCount = state.breakpointCount ?? 3;
  const scale = state.scale || 'medium';
  // Scale drives font size directly - ensures content fits the window
  const fontSize = scale;

  // Background color with opacity
  const bgR = 13, bgG = 11, bgB = 10; // #0d0b0a (warm black)
  const bgColor = `rgba(${bgR}, ${bgG}, ${bgB}, ${bgOpacity})`;

  // Scale-based layout classes
  const contentPadding = scale === 'small' ? 'p-1.5 space-y-1' : scale === 'large' ? 'p-4 space-y-2' : 'p-3 space-y-2';

  // Border style based on accent color
  const borderStyle = isTransparentAccent
    ? '1px solid rgba(58, 58, 62, 0.3)'
    : `2px solid ${accentColor}`;

  return (
    <div
      className={`w-full h-full rounded-lg overflow-hidden ${isLocked ? '' : 'drag-handle'}`}
      style={{
        backgroundColor: bgColor,
        border: borderStyle,
        boxShadow: isTransparentAccent ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.8)',
        '--overlay-accent': accentColor,
      } as React.CSSProperties}
      onMouseDown={handleMouseDown}
    >
      {/* Content - overflow hidden clips breakpoints on small scale */}
      <div className={contentPadding}>
        {/* Timer */}
        {showTimer && (
          <OverlayTimer startTime={state.startTime} elapsedMs={state.elapsedMs} isRunning={state.isRunning} fontSize={fontSize} hotkeyToggleTimer={state.hotkeyToggleTimer} />
        )}

        {/* Current zone */}
        {showZone && (
          <OverlayZone
            zoneName={state.currentZone}
            fontSize={fontSize}
            isAhead={state.lastSplit?.deltaMs != null ? state.lastSplit.deltaMs < 0 : undefined}
          />
        )}

        {/* Last split */}
        {showLastSplit && state.lastSplit && (
          <OverlaySplit
            name={state.lastSplit.name}
            deltaMs={state.lastSplit.deltaMs}
            isBestSegment={state.lastSplit.isBestSegment}
            splitTimeMs={state.lastSplit.splitTimeMs}
            segmentTimeMs={state.lastSplit.segmentTimeMs}
            pbSegmentTimeMs={state.lastSplit.pbSegmentTimeMs}
            goldSegmentTimeMs={state.lastSplit.goldSegmentTimeMs}
            fontSize={fontSize}
            scale={scale}
          />
        )}

        {/* Upcoming breakpoints */}
        {showBreakpoints && state.upcomingBreakpoints.length > 0 && (
          <OverlayBreakpoints
            breakpoints={state.upcomingBreakpoints}
            maxCount={breakpointCount}
            fontSize={fontSize}
            startTime={state.startTime}
            elapsedMs={state.elapsedMs}
            isRunning={state.isRunning}
          />
        )}
      </div>
    </div>
  );
}
