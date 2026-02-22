import { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, ArrowLeft, CheckCircle2, Circle, MapPin } from 'lucide-react';
import { usePracticeStore } from '../../stores/practiceStore';
import { useRunStore } from '../../stores/runStore';
import { Button } from '../Shared/Button';

export function PracticeTimer() {
  const {
    mode, selectedZones, timer, attempts, bestTimeMs,
    startPractice, stopPractice, resetPractice, updateElapsed,
  } = usePracticeStore();
  const currentZone = useRunStore((s) => s.timer.currentZone);
  const animationRef = useRef<number | null>(null);

  // Update timer every frame
  useEffect(() => {
    const tick = () => {
      if (timer.isRunning && timer.startTime) {
        updateElapsed(Date.now() - timer.startTime);
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    if (timer.isRunning) {
      animationRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [timer.isRunning, timer.startTime, updateElapsed]);

  const handleBack = () => {
    stopPractice();
    resetPractice();
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-elevated] transition-colors"
          title="Back to zone selector"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-[--color-text]">
            {mode === 'single_zone' ? 'Single Zone Practice' : 'Route Practice'}
          </h2>
          <p className="text-xs text-[--color-text-muted]">
            Attempt #{attempts.length + 1}
            {bestTimeMs !== null && (
              <span className="ml-2">
                Best: <span className="text-[--color-timer-gold] timer-display">{formatTime(bestTimeMs)}</span>
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Timer display */}
      <div className="card-inset rounded-lg p-6 text-center">
        <div className="timer-display timer-glow text-5xl font-bold text-[--color-text]">
          {formatTime(timer.elapsedMs)}
        </div>

        {/* Delta vs best */}
        {bestTimeMs !== null && timer.isRunning && (
          <div className={`timer-display text-xl mt-2 ${timer.elapsedMs > bestTimeMs ? 'text-[--color-timer-behind]' : 'text-[--color-timer-ahead]'}`}>
            {timer.elapsedMs > bestTimeMs
              ? `+${formatTime(timer.elapsedMs - bestTimeMs)}`
              : `-${formatTime(bestTimeMs - timer.elapsedMs)}`
            }
          </div>
        )}

        {/* Current zone display */}
        <div className="mt-3 text-sm text-[--color-text-muted]">
          <MapPin className="w-3.5 h-3.5 inline mr-1" />
          {currentZone || 'Waiting for zone...'}
        </div>

        {/* Death count */}
        {timer.deathCount > 0 && (
          <div className="mt-1 text-xs text-red-400">
            Deaths: {timer.deathCount}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {!timer.isRunning ? (
          <Button
            variant="primary"
            size="lg"
            icon={Play}
            onClick={startPractice}
            className="flex-1"
            style={{ background: 'linear-gradient(180deg, #2cc660 0%, #189845 100%)', borderColor: '#44d070', color: 'white', boxShadow: '0 0 14px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)' }}
          >
            {timer.elapsedMs > 0 ? 'Resume' : 'Start'}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            icon={Pause}
            onClick={stopPractice}
            className="flex-1"
          >
            Pause
          </Button>
        )}

        <Button
          variant="destructive"
          size="lg"
          icon={RotateCcw}
          onClick={resetPractice}
          disabled={timer.elapsedMs === 0 && !timer.isRunning}
        >
          Reset
        </Button>
      </div>

      {/* Zone progression (route mode) */}
      {mode === 'route' && (
        <div className="card-inset rounded-lg p-3 flex-1 overflow-auto">
          <h3 className="text-sm font-semibold text-[--color-text] mb-2">
            Route Progress ({timer.completedZones.length}/{selectedZones.length})
          </h3>
          <div className="flex flex-col gap-1">
            {selectedZones.map((zone, index) => {
              const isCompleted = index < timer.currentZoneIndex;
              const isCurrent = index === timer.currentZoneIndex;
              return (
                <div
                  key={`${zone.zoneName}-${zone.act}`}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                    isCurrent
                      ? 'bg-[--color-poe-gold]/10 text-[--color-poe-gold]'
                      : isCompleted
                        ? 'text-[--color-text-muted]'
                        : 'text-[--color-text-muted]/50'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : isCurrent ? (
                    <Circle className="w-4 h-4 text-[--color-poe-gold] flex-shrink-0 animate-pulse" />
                  ) : (
                    <Circle className="w-4 h-4 flex-shrink-0 opacity-30" />
                  )}
                  <span className="text-xs w-5">A{zone.act}</span>
                  <span className={`flex-1 truncate ${isCurrent ? 'font-medium' : ''}`}>{zone.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Single zone mode - target indicator */}
      {mode === 'single_zone' && selectedZones.length > 0 && (
        <div className="card-inset rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[--color-text-muted]">Target:</span>
            <span className="text-[--color-poe-gold] font-medium">{selectedZones[0].name}</span>
            <span className="text-[--color-text-muted] text-xs">(A{selectedZones[0].act})</span>
          </div>
          <p className="text-xs text-[--color-text-muted] mt-1">
            Timer auto-resets when you enter this zone. Start timer before entering the zone preceding this one.
          </p>
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
