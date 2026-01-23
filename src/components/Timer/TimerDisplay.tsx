interface TimerDisplayProps {
  elapsedMs: number;
  deltaMs?: number | null;
}

export function TimerDisplay({ elapsedMs, deltaMs }: TimerDisplayProps) {
  const formattedTime = formatTime(elapsedMs);
  const deltaColor = getDeltaColor(deltaMs);

  return (
    <div className="text-center">
      <div className="timer-display text-6xl font-bold text-[--color-text]">
        {formattedTime}
      </div>

      {deltaMs !== null && deltaMs !== undefined && (
        <div className={`timer-display text-2xl mt-2 ${deltaColor}`}>
          {formatDelta(deltaMs)}
        </div>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

function formatDelta(ms: number): string {
  const sign = ms >= 0 ? '+' : '-';
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((absMs % 1000) / 10);

  if (minutes > 0) {
    return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }
  return `${sign}${seconds}.${centiseconds.toString().padStart(2, '0')}`;
}

function getDeltaColor(deltaMs: number | null | undefined): string {
  if (deltaMs === null || deltaMs === undefined) return 'text-[--color-timer-neutral]';
  if (deltaMs < 0) return 'text-[--color-timer-ahead]';
  if (deltaMs > 0) return 'text-[--color-timer-behind]';
  return 'text-[--color-timer-neutral]';
}
