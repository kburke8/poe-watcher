import { useEffect, useRef, useState } from 'react';

interface OverlayTimerProps {
  startTime: number | null;
  elapsedMs: number;
  isRunning: boolean;
  fontSize?: 'small' | 'medium' | 'large';
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

export function OverlayTimer({ startTime, elapsedMs, isRunning, fontSize = 'medium' }: OverlayTimerProps) {
  const [displayMs, setDisplayMs] = useState(elapsedMs);
  const animationRef = useRef<number | null>(null);

  // Run our own animation loop to compute elapsed time locally
  useEffect(() => {
    if (isRunning && startTime) {
      const updateTimer = () => {
        setDisplayMs(Date.now() - startTime);
        animationRef.current = requestAnimationFrame(updateTimer);
      };
      animationRef.current = requestAnimationFrame(updateTimer);
    } else {
      // When not running, use the last known elapsedMs from the main window
      setDisplayMs(elapsedMs);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, startTime, elapsedMs]);

  const timerSizeClass = fontSize === 'small' ? 'text-xl' : fontSize === 'large' ? 'text-4xl' : 'text-3xl';
  const hintSizeClass = fontSize === 'small' ? 'text-[10px]' : 'text-xs';

  return (
    <div className="text-center">
      <div
        className={`timer-display ${timerSizeClass} font-bold`}
        style={{ color: isRunning ? '#ffffff' : '#9ca3af' }}
      >
        {formatTime(displayMs)}
      </div>
      {!isRunning && elapsedMs === 0 && (
        <div className={`${hintSizeClass} mt-1`} style={{ color: '#6b7280' }}>
          Ctrl+Space to start
        </div>
      )}
    </div>
  );
}
