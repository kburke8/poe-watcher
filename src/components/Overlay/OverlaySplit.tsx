interface OverlaySplitProps {
  name: string;
  deltaMs: number | null;
  isBestSegment: boolean;
}

function formatDelta(ms: number): string {
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const sign = ms >= 0 ? '+' : '-';

  if (minutes > 0) {
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${sign}${seconds}s`;
}

export function OverlaySplit({ name, deltaMs, isBestSegment }: OverlaySplitProps) {
  let deltaColor = '#9ca3af'; // neutral
  if (isBestSegment) {
    deltaColor = '#fbbf24'; // gold
  } else if (deltaMs !== null) {
    deltaColor = deltaMs < 0 ? '#22c55e' : '#ef4444'; // ahead / behind
  }

  return (
    <div className="flex items-center justify-between text-sm pt-2" style={{ borderTop: '1px solid #3a3a3e' }}>
      <span className="truncate flex-1" style={{ color: '#9ca3af' }} title={name}>
        {name}
      </span>
      <span className="font-medium ml-2 flex items-center gap-1" style={{ color: deltaColor }}>
        {isBestSegment && (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        )}
        {deltaMs !== null ? formatDelta(deltaMs) : '--'}
      </span>
    </div>
  );
}
