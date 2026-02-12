interface OverlaySplitProps {
  name: string;
  deltaMs: number | null;
  isBestSegment: boolean;
  splitTimeMs?: number;
  segmentTimeMs?: number;
  pbSegmentTimeMs?: number | null;
  goldSegmentTimeMs?: number | null;
  fontSize?: 'small' | 'medium' | 'large';
  scale?: 'small' | 'medium' | 'large';
}

function formatDelta(ms: number): string {
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((absMs % 1000) / 10);
  const sign = ms >= 0 ? '+' : '-';

  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function formatSplitTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatSegmentTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}

export function OverlaySplit({ name, deltaMs, isBestSegment, splitTimeMs, segmentTimeMs, pbSegmentTimeMs, goldSegmentTimeMs, fontSize = 'medium', scale = 'medium' }: OverlaySplitProps) {
  let deltaColor = '#9ca3af'; // neutral
  if (isBestSegment) {
    deltaColor = '#fbbf24'; // gold
  } else if (deltaMs !== null) {
    deltaColor = deltaMs < 0 ? '#22c55e' : '#d4a574'; // ahead / behind (amber)
  }

  const sizeClass = fontSize === 'small' ? 'text-xs' : fontSize === 'large' ? 'text-base' : 'text-sm';
  const detailSizeClass = fontSize === 'small' ? 'text-[9px]' : fontSize === 'large' ? 'text-sm' : 'text-xs';
  const ptClass = scale === 'small' ? 'pt-1' : 'pt-2';

  // Build segment comparison text
  const hasComparison = segmentTimeMs !== undefined && (pbSegmentTimeMs || goldSegmentTimeMs);

  return (
    <div className={`${ptClass}`} style={{ borderTop: '1px solid rgba(58, 58, 62, 0.5)' }}>
      <div className={`flex items-center justify-between ${sizeClass}`}>
        <span className="truncate flex-1" style={{ color: '#9ca3af' }} title={name}>
          {name}
        </span>
        <span className="font-medium ml-2 flex items-center gap-1.5">
          {splitTimeMs != null && (
            <span style={{ color: '#9ca3af' }} className="font-mono">
              {formatSplitTime(splitTimeMs)}
            </span>
          )}
          <span style={{ color: deltaColor }} className="flex items-center gap-1">
            {isBestSegment && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
            {deltaMs !== null ? formatDelta(deltaMs) : '--'}
          </span>
        </span>
      </div>
      {/* Segment comparison line */}
      {hasComparison && (
        <div className={`${detailSizeClass} flex items-center gap-2 mt-0.5`} style={{ color: '#6b7280' }}>
          <span>Seg: {formatSegmentTime(segmentTimeMs!)}</span>
          {pbSegmentTimeMs != null && (
            <span>PB: {formatSegmentTime(pbSegmentTimeMs)}</span>
          )}
          {goldSegmentTimeMs != null && (
            <span style={{ color: '#fbbf24' }}>Gold: {formatSegmentTime(goldSegmentTimeMs)}</span>
          )}
        </div>
      )}
    </div>
  );
}
