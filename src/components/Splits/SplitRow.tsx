import type { BreakpointType } from '../../types';

interface SplitRowProps {
  name: string;
  type: BreakpointType;
  splitTime: number | null;
  segmentTime: number | null;
  delta: number | null;
  isBestSegment: boolean;
  isNext: boolean;
  isCompleted: boolean;
}

export function SplitRow({
  name,
  type,
  splitTime,
  segmentTime,
  delta,
  isBestSegment,
  isNext,
  isCompleted,
}: SplitRowProps) {
  const typeIcon = getTypeIcon(type);
  const deltaColor = getDeltaColor(delta);
  // segmentTime is passed for future use (e.g., showing segment comparison)
  void segmentTime;
  const rowBg = isNext
    ? 'bg-[--color-surface-elevated]'
    : isCompleted
    ? ''
    : 'opacity-50';

  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${rowBg}`}>
      {/* Type icon */}
      <span className="text-sm w-5 text-center" title={type}>
        {typeIcon}
      </span>

      {/* Split name */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm truncate block ${isCompleted ? 'text-[--color-text]' : 'text-[--color-text-muted]'}`}>
          {name}
        </span>
        {isBestSegment && isCompleted && (
          <span className="text-xs text-[--color-timer-gold]">Best Segment!</span>
        )}
      </div>

      {/* Times */}
      {isCompleted && (
        <div className="text-right">
          {/* Delta */}
          {delta !== null && (
            <div className={`timer-display text-sm ${deltaColor}`}>
              {formatDelta(delta)}
            </div>
          )}
          {/* Split time */}
          <div className="timer-display text-xs text-[--color-text-muted]">
            {formatTime(splitTime ?? 0)}
          </div>
        </div>
      )}

      {/* Current indicator */}
      {isNext && (
        <div className="w-2 h-2 rounded-full bg-[--color-poe-gold] animate-pulse" />
      )}
    </div>
  );
}

function getTypeIcon(type: BreakpointType): string {
  switch (type) {
    case 'zone': return '📍';
    case 'level': return '⬆';
    case 'boss': return '💀';
    case 'act': return '🏛';
    case 'lab': return '🏆';
    case 'custom': return '⭐';
    default: return '•';
  }
}

function getDeltaColor(delta: number | null): string {
  if (delta === null) return 'text-[--color-timer-neutral]';
  if (delta < 0) return 'text-[--color-timer-ahead]';
  if (delta > 0) return 'text-[--color-timer-behind]';
  return 'text-[--color-timer-neutral]';
}

function formatDelta(ms: number): string {
  const sign = ms >= 0 ? '+' : '-';
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${sign}${seconds}s`;
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
