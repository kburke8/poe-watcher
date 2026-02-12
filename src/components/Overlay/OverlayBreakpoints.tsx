import { useEffect, useRef, useState } from 'react';

interface UpcomingBreakpoint {
  name: string;
  pbTimeMs: number | null;
  pbSegmentTimeMs: number | null;
}

interface OverlayBreakpointsProps {
  breakpoints: UpcomingBreakpoint[];
  maxCount?: number;
  fontSize?: 'small' | 'medium' | 'large';
  startTime: number | null;
  elapsedMs: number;
  isRunning: boolean;
}

const THRESHOLD_RATIO = 0.33;
const THRESHOLD_CAP_MS = 60000; // 60 seconds max

function formatPbTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDelta(ms: number): string {
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  // Positive timeUntilPb means ahead (still have time), negative means behind
  const sign = ms >= 0 ? '-' : '+';

  if (minutes > 0) {
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${sign}0:${seconds.toString().padStart(2, '0')}`;
}

export function OverlayBreakpoints({ breakpoints, maxCount = 3, fontSize = 'medium', startTime, elapsedMs, isRunning }: OverlayBreakpointsProps) {
  const visibleBreakpoints = breakpoints.slice(0, maxCount);
  const itemClass = fontSize === 'small' ? 'text-[10px]' : fontSize === 'large' ? 'text-sm' : 'text-xs';

  // Tick every second when running so countdowns update live
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && startTime != null) {
      intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, startTime]);

  // Suppress unused warning - tick drives re-renders
  void tick;

  const currentElapsed = isRunning && startTime ? Date.now() - startTime : elapsedMs;

  return (
    <div className="pt-1" style={{ borderTop: '1px solid rgba(58, 58, 62, 0.5)' }}>
      <div className="space-y-0.5">
        {visibleBreakpoints.map((bp, index) => {
          // Determine whether to show absolute PB time or live delta
          let showDelta = false;
          let timeUntilPb = 0;

          if (bp.pbTimeMs != null) {
            timeUntilPb = bp.pbTimeMs - currentElapsed;
            const threshold = bp.pbSegmentTimeMs != null
              ? Math.min(bp.pbSegmentTimeMs * THRESHOLD_RATIO, THRESHOLD_CAP_MS)
              : THRESHOLD_CAP_MS;
            showDelta = timeUntilPb < threshold;
          }

          // Delta color: green when ahead (timeUntilPb > 0), amber when behind
          const deltaColor = timeUntilPb >= 0 ? '#22c55e' : '#d4a574';

          return (
            <div
              key={index}
              className={`${itemClass} flex items-center justify-between`}
              title={bp.name}
            >
              <span
                className="truncate flex-1"
                style={{ color: index === 0 ? '#e5e5e5' : '#9ca3af' }}
              >
                {index === 0 ? '> ' : '  '}
                {bp.name}
              </span>
              {bp.pbTimeMs != null && (
                showDelta ? (
                  <span className="ml-2 font-mono flex-shrink-0 font-medium" style={{ color: deltaColor }}>
                    {formatDelta(timeUntilPb)}
                  </span>
                ) : (
                  <span className="ml-2 font-mono flex-shrink-0" style={{ color: '#6b7280' }}>
                    {formatPbTime(bp.pbTimeMs)}
                  </span>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
