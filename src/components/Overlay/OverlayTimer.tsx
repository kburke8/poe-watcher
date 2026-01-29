interface OverlayTimerProps {
  elapsedMs: number;
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

export function OverlayTimer({ elapsedMs, isRunning }: OverlayTimerProps) {
  return (
    <div className="text-center">
      <div
        className={`timer-display text-3xl font-bold ${
          isRunning ? 'text-[--color-text]' : 'text-[--color-text-muted]'
        }`}
      >
        {formatTime(elapsedMs)}
      </div>
      {!isRunning && elapsedMs === 0 && (
        <div className="text-xs text-[--color-text-muted] mt-1">
          Ctrl+Space to start
        </div>
      )}
    </div>
  );
}
