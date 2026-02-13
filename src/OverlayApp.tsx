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

  // Window opacity is applied via CSS (Tauri 2.x doesn't have setOpacity API)

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

  // Handle dragging
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

  // Derive display values from config
  const accentColor = state.accentColor || 'transparent';
  const isTransparentAccent = accentColor === 'transparent';
  const bgOpacity = state.bgOpacity ?? 0.9;
  const windowOpacity = state.opacity ?? 0.8;
  const showTimer = state.showTimer ?? true;
  const showZone = state.showZone ?? true;
  const showLastSplit = state.showLastSplit ?? true;
  const showBreakpoints = state.showBreakpoints ?? true;
  const breakpointCount = state.breakpointCount ?? 3;
  const scale = state.scale || 'medium';
  // Scale drives font size directly - ensures content fits the window
  const fontSize = scale;

  // Background color with opacity
  const bgR = 12, bgG = 12, bgB = 14; // #0c0c0e
  const bgColor = `rgba(${bgR}, ${bgG}, ${bgB}, ${bgOpacity})`;

  // Scale-based layout classes
  const headerPx = scale === 'small' ? 'px-2 py-0.5' : scale === 'large' ? 'px-4 py-1.5' : 'px-3 py-1';
  const contentPadding = scale === 'small' ? 'p-1.5 space-y-1' : scale === 'large' ? 'p-4 space-y-2' : 'p-3 space-y-2';
  const headerTextSize = scale === 'small' ? 'text-[10px]' : 'text-xs';
  const iconSize = scale === 'small' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  // Border style based on accent color
  const borderStyle = isLocked
    ? '1px solid rgba(58, 58, 62, 0.5)'
    : isTransparentAccent
      ? '1px solid rgba(58, 58, 62, 0.3)'
      : `2px solid ${accentColor}`;

  return (
    <div
      className={`w-full h-full rounded-lg overflow-hidden ${isLocked ? '' : 'drag-handle'}`}
      style={{
        backgroundColor: bgColor,
        border: borderStyle,
        boxShadow: isTransparentAccent ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.8)',
        opacity: windowOpacity,
        '--overlay-accent': accentColor,
      } as React.CSSProperties}
      onMouseDown={handleMouseDown}
    >
      {/* Header with controls */}
      <div className={`flex items-center justify-between ${headerPx}`} style={{ borderBottom: '1px solid rgba(58, 58, 62, 0.5)' }}>
        <span className={`${headerTextSize} font-semibold`} style={{ color: isTransparentAccent ? '#9ca3af' : accentColor }}>
          {isLocked ? 'Locked' : 'POE Watcher'}
        </span>
        <div className="flex items-center gap-0.5">
          {/* Lock button */}
          <button
            onClick={handleToggleLock}
            className="p-0.5"
            style={{ color: isLocked ? '#fbbf24' : '#9ca3af' }}
            title={isLocked ? 'Unlock overlay (Ctrl+Shift+O)' : 'Lock overlay (Ctrl+Shift+O)'}
          >
            {isLocked ? (
              <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
            ) : (
              <svg className={iconSize} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>
              </svg>
            )}
          </button>
          {/* Close button */}
          <button
            onClick={handleClose}
            className="p-0.5"
            style={{ color: '#9ca3af' }}
            title="Close overlay (Ctrl+O)"
          >
            <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={contentPadding}>
        {/* Timer */}
        {showTimer && (
          <OverlayTimer startTime={state.startTime} elapsedMs={state.elapsedMs} isRunning={state.isRunning} fontSize={fontSize} />
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
