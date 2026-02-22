import { Trophy, Clock, Trash2, Skull } from 'lucide-react';
import { usePracticeStore } from '../../stores/practiceStore';
import { EmptyState } from '../Shared/EmptyState';

export function PracticeHistory() {
  const { attempts, bestTimeMs, clearAttempts, mode, selectedZones } = usePracticeStore();

  // Calculate stats
  const avgTimeMs = attempts.length > 0
    ? attempts.reduce((sum, a) => sum + a.timeMs, 0) / attempts.length
    : null;
  const totalDeaths = attempts.reduce((sum, a) => sum + a.deathCount, 0);

  return (
    <div className="card-inset rounded-lg h-full flex flex-col">
      <div className="p-4 section-header rounded-t-lg flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[--color-text]">Attempts</h2>
          <p className="text-xs text-[--color-text-muted] mt-1">
            {attempts.length} attempt{attempts.length !== 1 ? 's' : ''}
          </p>
        </div>
        {attempts.length > 0 && (
          <button
            onClick={clearAttempts}
            className="p-1.5 rounded-md text-[--color-text-muted] hover:text-red-400 transition-colors"
            title="Clear all attempts"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Stats summary */}
      {attempts.length > 0 && (
        <div className="px-4 py-3 border-b border-[--color-border] space-y-1.5">
          {bestTimeMs !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[--color-text-muted] flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-[--color-timer-gold]" />
                Best
              </span>
              <span className="timer-display text-[--color-timer-gold]">{formatTime(bestTimeMs)}</span>
            </div>
          )}
          {avgTimeMs !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[--color-text-muted] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Average
              </span>
              <span className="timer-display text-[--color-text]">{formatTime(avgTimeMs)}</span>
            </div>
          )}
          {totalDeaths > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[--color-text-muted] flex items-center gap-1.5">
                <Skull className="w-3.5 h-3.5 text-red-400" />
                Deaths
              </span>
              <span className="text-red-400">{totalDeaths}</span>
            </div>
          )}
        </div>
      )}

      {/* Attempt list */}
      <div className="flex-1 overflow-auto">
        {attempts.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No attempts yet"
            description={
              mode === 'single_zone'
                ? `Start the timer, then enter ${selectedZones[0]?.name || 'the target zone'} to record an attempt.`
                : 'Start the timer and run through the route to record an attempt.'
            }
          />
        ) : (
          <div className="divide-y divide-[--color-border]">
            {/* Header */}
            <div className="px-4 py-2 flex items-center gap-3 bg-[--color-surface] border-b border-[--color-border] sticky top-0">
              <span className="w-8 text-xs text-[--color-text-muted] text-center">#</span>
              <span className="flex-1 text-xs text-[--color-text-muted] uppercase tracking-wide">Time</span>
              <span className="text-xs text-[--color-text-muted] uppercase tracking-wide min-w-[55px] text-right">Delta</span>
            </div>
            {[...attempts].reverse().map((attempt, reverseIndex) => {
              const index = attempts.length - reverseIndex;
              const isBest = attempt.timeMs === bestTimeMs;
              const deltaMs = bestTimeMs !== null ? attempt.timeMs - bestTimeMs : null;

              return (
                <div
                  key={attempt.id}
                  className={`px-4 py-2 flex items-center gap-3 ${isBest ? 'bg-[--color-timer-gold]/5' : ''}`}
                >
                  <span className={`w-8 text-center text-xs ${isBest ? 'text-[--color-timer-gold]' : 'text-[--color-text-muted]'}`}>
                    {isBest ? <Trophy className="w-3.5 h-3.5 inline" /> : index}
                  </span>
                  <span className={`flex-1 timer-display text-sm ${isBest ? 'text-[--color-timer-gold]' : 'text-[--color-text]'}`}>
                    {formatTime(attempt.timeMs)}
                    {attempt.deathCount > 0 && (
                      <span className="text-red-400 text-xs ml-1.5">
                        <Skull className="w-3 h-3 inline" /> {attempt.deathCount}
                      </span>
                    )}
                  </span>
                  <span className={`timer-display text-xs min-w-[55px] text-right ${
                    deltaMs === null || deltaMs === 0
                      ? 'text-[--color-text-muted]'
                      : deltaMs > 0
                        ? 'text-[--color-timer-behind]'
                        : 'text-[--color-timer-ahead]'
                  }`}>
                    {deltaMs === null || deltaMs === 0
                      ? '--'
                      : `+${formatTime(deltaMs)}`
                    }
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
