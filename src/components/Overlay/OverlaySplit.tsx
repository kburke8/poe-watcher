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
  // Determine color based on delta and best segment
  let deltaColor = 'text-[--color-text-muted]';
  if (isBestSegment) {
    deltaColor = 'text-[--color-timer-gold]';
  } else if (deltaMs !== null) {
    deltaColor = deltaMs < 0 ? 'text-[--color-timer-ahead]' : 'text-[--color-timer-behind]';
  }

  return (
    <div className="flex items-center justify-between text-sm border-t border-[--color-border] pt-2">
      <span className="text-[--color-text-muted] truncate flex-1" title={name}>
        {name}
      </span>
      <span className={`${deltaColor} font-medium ml-2 flex items-center gap-1`}>
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
