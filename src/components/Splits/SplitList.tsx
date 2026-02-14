import { useRunStore } from '../../stores/runStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getWizardCategory } from '../../config/wizardRoutes';
import { SplitRow } from './SplitRow';

export function SplitList() {
  const { timer, currentRun, personalBests } = useRunStore();
  const { breakpoints, wizardConfig } = useSettingsStore();

  const enabledBreakpoints = breakpoints.filter((bp) => bp.isEnabled);
  const completedSplits = timer.splits;

  // Determine run category and class for PB lookup
  const category = currentRun?.category
    ?? (wizardConfig ? getWizardCategory(wizardConfig) : null);
  const cls = currentRun?.class ?? 'Unknown';

  return (
    <div className="bg-[--color-surface] rounded-lg h-full flex flex-col">
      <div className="p-4 border-b border-[--color-border]">
        <h2 className="text-lg font-semibold text-[--color-text]">Splits</h2>
        <p className="text-xs text-[--color-text-muted] mt-1">
          {completedSplits.length} / {enabledBreakpoints.length}
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        {enabledBreakpoints.length === 0 ? (
          <div className="p-4 text-center text-[--color-text-muted]">
            <p>No breakpoints configured.</p>
            <p className="text-sm mt-1">Add breakpoints in Settings.</p>
          </div>
        ) : (
          <div className="divide-y divide-[--color-border]">
            {/* Column headers */}
            <div className="px-4 py-2 flex items-center gap-3 bg-[--color-surface] border-b border-[--color-border] sticky top-0">
              <span className="w-5" />
              <span className="flex-1 text-xs text-[--color-text-muted] uppercase tracking-wide">Split</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[--color-text-muted] uppercase tracking-wide min-w-[50px] text-right">Seg</span>
                <span className="text-xs text-[--color-text-muted] uppercase tracking-wide min-w-[55px] text-right">+/−</span>
                <span className="text-xs text-[--color-text-muted] uppercase tracking-wide min-w-[50px] text-right">Time</span>
              </div>
            </div>
            {enabledBreakpoints.map((bp, index) => {
              const split = completedSplits[index];
              const isNext = index === completedSplits.length;
              const isCompleted = index < completedSplits.length;

              // Look up PB split time for this breakpoint
              const pbTime = category ? (personalBests.get(`${category}-${cls}-${bp.name}`) ?? null) : null;

              return (
                <SplitRow
                  key={bp.name}
                  name={bp.name}
                  type={bp.type}
                  splitTime={split?.splitTimeMs ?? null}
                  segmentTime={split?.segmentTimeMs ?? null}
                  delta={split?.deltaMs ?? null}
                  isBestSegment={split?.isBestSegment ?? false}
                  isNext={isNext}
                  isCompleted={isCompleted}
                  pbTime={pbTime}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Summary footer */}
      {completedSplits.length > 0 && (
        <div className="p-4 border-t border-[--color-border]">
          <div className="flex justify-between text-sm">
            <span className="text-[--color-text-muted]">Sum of Best:</span>
            <span className="timer-display text-[--color-timer-gold]">
              {formatTime(calculateSumOfBest(completedSplits))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function calculateSumOfBest(splits: { segmentTimeMs: number; isBestSegment: boolean }[]): number {
  return splits.reduce((sum, split) => sum + (split.isBestSegment ? split.segmentTimeMs : split.segmentTimeMs), 0);
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
