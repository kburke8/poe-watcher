import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { OverlayTimer } from './components/Overlay/OverlayTimer';
import { OverlayZone } from './components/Overlay/OverlayZone';
import { OverlaySplit } from './components/Overlay/OverlaySplit';
import { OverlayBreakpoints } from './components/Overlay/OverlayBreakpoints';
import { OverlayFinalTime } from './components/Overlay/OverlayFinalTime';
import { OverlayEndgameStats } from './components/Overlay/OverlayEndgameStats';

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
  // Hotkey labels
  hotkeyToggleTimer?: string;
  hotkeyToggleOverlay?: string;
  // Endgame mode
  isEndgame?: boolean;
  endgame?: {
    act10FinalTimeMs: number | null;
    isMappingSession?: boolean;
    townHideoutTimeMs: number;
    deathCount: number;
    mapCount: number;
    currentMapStartTime: number | null;
    currentMapElapsedMs: number;
    currentMapZone: string | null;
  } | null;
  // Transparency mode
  transparent?: boolean;
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
  const prevScaleRef = useRef<string | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  // When opaque mode: set a solid body background so there's no transparency bleed-through
  useEffect(() => {
    const isTransparent = state.transparent ?? true;
    if (!isTransparent) {
      document.body.style.backgroundColor = 'rgb(0, 0, 0)';
      document.documentElement.style.backgroundColor = 'rgb(0, 0, 0)';
    } else {
      document.body.style.backgroundColor = 'transparent';
      document.documentElement.style.backgroundColor = 'transparent';
    }
  }, [state.transparent]);

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

  // Sync scale changes - update width (height is auto-sized from content)
  useEffect(() => {
    if (state.scale && state.scale !== prevScaleRef.current) {
      prevScaleRef.current = state.scale;
      const widths = { small: 240, medium: 320, large: 420 };
      const w = widths[state.scale] || widths.medium;
      // Set width; height will be adjusted by ResizeObserver below
      const el = contentRef.current;
      const h = el ? el.scrollHeight + 4 : 120; // 4px for border
      invoke('resize_overlay', { width: w, height: h }).catch(() => {});
    }
  }, [state.scale]);

  // Auto-resize overlay height to fit content
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const scale = state.scale || 'medium';
    const widths = { small: 240, medium: 320, large: 420 };
    const w = widths[scale] || widths.medium;

    const observer = new ResizeObserver(() => {
      const h = el.scrollHeight + 4; // 4px for border
      invoke('resize_overlay', { width: w, height: h }).catch(() => {});
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [state.scale, state.showTimer, state.showZone, state.showLastSplit, state.showBreakpoints, state.breakpointCount, state.isEndgame]);

  // Sync always-on-top changes
  useEffect(() => {
    if (state.alwaysOnTop !== undefined) {
      invoke('set_overlay_always_on_top', { enabled: state.alwaysOnTop }).catch(() => {});
    }
  }, [state.alwaysOnTop]);

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
    e.preventDefault();
    getCurrentWindow().startDragging();
  }, []);

  // Derive display values from config
  const scale = state.scale || 'medium';
  const accentColor = state.accentColor || 'transparent';
  const isTransparentAccent = accentColor === 'transparent';
  const showTimer = state.showTimer ?? true;
  const showZone = state.showZone ?? true;
  const showLastSplit = state.showLastSplit ?? true;
  const showBreakpoints = state.showBreakpoints ?? true;
  const breakpointCount = state.breakpointCount ?? 3;
  // Scale drives font size directly - ensures content fits the window
  const fontSize = scale;

  // Background color — when transparent: rgba alpha controls visibility; when opaque: solid
  const isTransparent = state.transparent ?? true;
  const bgOpacity = isTransparent ? (state.bgOpacity ?? 1) : 1;
  const bgColor = `rgba(13, 11, 10, ${bgOpacity})`;

  // Scale-based layout classes
  const contentPadding = scale === 'small' ? 'p-1.5 space-y-1' : scale === 'large' ? 'p-4 space-y-2' : 'p-3 space-y-2';

  // Border style based on accent color
  const borderStyle = isTransparentAccent
    ? '1px solid rgba(58, 58, 62, 0.3)'
    : `2px solid ${accentColor}`;

  return (
    <div
      className="w-full h-full overflow-hidden drag-handle"
      style={{
        opacity: state.opacity ?? 0.8,
        border: borderStyle,
        boxShadow: isTransparentAccent ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.8)',
        '--overlay-accent': accentColor,
      } as React.CSSProperties}
      onMouseDown={handleMouseDown}
    >
      <div ref={contentRef} className={contentPadding} style={{ backgroundColor: bgColor }}>
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
            hotkeyHint={state.hotkeyToggleTimer}
            showHotkeyHint={!state.isRunning && state.elapsedMs === 0}
          />
        )}

        {/* Last split / Endgame final time */}
        {showLastSplit && (
          state.isEndgame && state.endgame && !state.endgame.isMappingSession && state.endgame.act10FinalTimeMs != null ? (
            <OverlayFinalTime
              finalTimeMs={state.endgame.act10FinalTimeMs}
              fontSize={fontSize}
              scale={scale}
            />
          ) : state.lastSplit ? (
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
          ) : (
            <div style={{ borderTop: '1px solid rgba(58, 58, 62, 0.5)' }} className={scale === 'small' ? 'pt-1' : 'pt-2'}>
              <div className={fontSize === 'small' ? 'text-xs' : fontSize === 'large' ? 'text-base' : 'text-sm'} style={{ color: '#4a4440' }}>No splits yet</div>
            </div>
          )
        )}

        {/* Upcoming breakpoints / Endgame stats */}
        {showBreakpoints && (
          state.isEndgame && state.endgame ? (
            <OverlayEndgameStats
              townHideoutTimeMs={state.endgame.townHideoutTimeMs}
              deathCount={state.endgame.deathCount}
              mapCount={state.endgame.mapCount}
              currentMapStartTime={state.endgame.currentMapStartTime}
              currentMapElapsedMs={state.endgame.currentMapElapsedMs}
              currentMapZone={state.endgame.currentMapZone}
              fontSize={fontSize}
              isRunning={state.isRunning}
            />
          ) : state.upcomingBreakpoints.length > 0 ? (
            <OverlayBreakpoints
              breakpoints={state.upcomingBreakpoints}
              maxCount={breakpointCount}
              fontSize={fontSize}
              startTime={state.startTime}
              elapsedMs={state.elapsedMs}
              isRunning={state.isRunning}
            />
          ) : (
            <div className="pt-1" style={{ borderTop: '1px solid rgba(58, 58, 62, 0.5)' }}>
              <div className="space-y-0.5">
                {Array.from({ length: breakpointCount }, (_, i) => (
                  <div key={i} className={fontSize === 'small' ? 'text-[10px]' : fontSize === 'large' ? 'text-sm' : 'text-xs'} style={{ color: '#4a4440' }}>{i === 0 ? 'Waiting for run...' : '\u00A0'}</div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
