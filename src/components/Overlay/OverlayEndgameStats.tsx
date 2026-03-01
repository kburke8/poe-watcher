import { useEffect, useRef, useState } from 'react';

interface OverlayEndgameStatsProps {
  townHideoutTimeMs: number;
  deathCount: number;
  mapCount: number;
  currentMapStartTime: number | null;
  currentMapElapsedMs: number;
  currentMapZone: string | null;
  fontSize?: 'small' | 'medium' | 'large';
  isRunning: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function OverlayEndgameStats({
  townHideoutTimeMs,
  deathCount,
  mapCount,
  currentMapStartTime,
  currentMapElapsedMs,
  currentMapZone,
  fontSize = 'medium',
  isRunning,
}: OverlayEndgameStatsProps) {
  const itemClass = fontSize === 'small' ? 'text-[10px]' : fontSize === 'large' ? 'text-sm' : 'text-xs';

  // Tick every second for live map timer
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && currentMapStartTime != null) {
      intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, currentMapStartTime]);

  // Suppress unused warning - tick drives re-renders
  void tick;

  // Compute live map time
  let mapTimeDisplay: string;
  if (currentMapZone == null) {
    mapTimeDisplay = '--:--';
  } else if (currentMapStartTime != null && isRunning) {
    const liveMs = currentMapElapsedMs + (Date.now() - currentMapStartTime);
    mapTimeDisplay = formatTime(liveMs);
  } else {
    mapTimeDisplay = currentMapElapsedMs > 0 ? formatTime(currentMapElapsedMs) : '--:--';
  }

  // Truncate zone name for display
  const displayZone = currentMapZone
    ? (currentMapZone.length > 18 ? currentMapZone.slice(0, 17) + '\u2026' : currentMapZone)
    : 'No map';

  return (
    <div className="pt-1" style={{ borderTop: '1px solid rgba(58, 58, 62, 0.5)' }}>
      <div className="space-y-0.5">
        {/* Row 1: Current map + live timer */}
        <div className={`${itemClass} flex items-center justify-between`} title={currentMapZone || undefined}>
          <span className="truncate flex-1" style={{ color: '#e8e0d6' }}>
            {displayZone}
          </span>
          <span className="ml-2 font-mono flex-shrink-0" style={{ color: '#e8e0d6' }}>
            {mapTimeDisplay}
          </span>
        </div>

        {/* Row 2: Town+HO time */}
        <div className={`${itemClass} flex items-center justify-between`}>
          <span style={{ color: '#d4a574' }}>Town+HO</span>
          <span className="ml-2 font-mono flex-shrink-0" style={{ color: '#d4a574' }}>
            {formatTime(townHideoutTimeMs)}
          </span>
        </div>

        {/* Row 3: Deaths + Maps */}
        <div className={`${itemClass} flex items-center justify-between`}>
          <span style={{ color: deathCount > 0 ? '#ef4444' : '#e8e0d6' }}>
            Deaths: {deathCount}
          </span>
          <span className="ml-2 flex-shrink-0" style={{ color: '#e8e0d6' }}>
            Maps: {mapCount}
          </span>
        </div>
      </div>
    </div>
  );
}
