import { ListChecks, Settings } from 'lucide-react';
import { useRunStore } from '../../stores/runStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getWizardCategory } from '../../config/wizardRoutes';
import { EmptyState } from '../Shared/EmptyState';
import { SplitRow } from './SplitRow';
import { ComparisonSelector } from './ComparisonSelector';

export function SplitList() {
  const { timer, currentRun, personalBests, comparisonSplits } = useRunStore();
  const { breakpoints, wizardConfig, navigateToSettingsTab,
          activeComparisonRunId, activeComparisonLabel } = useSettingsStore();

  const enabledBreakpoints = breakpoints.filter((bp) => bp.isEnabled);
  const completedSplits = timer.splits;

  // Determine run category and class for PB lookup
  const category = currentRun?.category
    ?? (wizardConfig ? getWizardCategory(wizardConfig) : null);
  const cls = currentRun?.class ?? 'Unknown';

  const hasComparison = activeComparisonRunId != null && comparisonSplits.size > 0;

  return (
    <div className="card-inset rounded-lg h-full flex flex-col">
      <div className="p-4 section-header rounded-t-lg flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[--color-text]">Splits</h2>
          <p className="text-xs text-[--color-text-muted] mt-1">
            {completedSplits.length} / {enabledBreakpoints.length}
          </p>
        </div>
        <button
          onClick={() => navigateToSettingsTab('breakpoints')}
          className="p-1.5 rounded-md text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-elevated] transition-colors"
          title="Edit breakpoints"
        >
          <Settings className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      <ComparisonSelector />

      <div className="flex-1 overflow-auto">
        {enabledBreakpoints.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No breakpoints configured"
            description="Add breakpoints in Settings to start tracking splits."
          />
        ) : (
          <div className="divide-y divide-[--color-border]">
            {/* Column headers */}
            <div className="px-4 py-2 flex items-center gap-3 bg-[--color-surface] border-b border-[--color-border] sticky top-0">
              <span className="w-5" />
              <span className="flex-1 text-xs text-[--color-text-muted] uppercase tracking-wide">Split</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[--color-text-muted] uppercase tracking-wide min-w-[50px] text-right">Seg</span>
                <span
                  className="text-xs text-[--color-text-muted] uppercase tracking-wide min-w-[55px] text-right"
                  title={hasComparison ? `Delta vs ${activeComparisonLabel}` : 'Delta vs PB'}
                >
                  {hasComparison ? 'vs Cmp' : '+/-'}
                </span>
                <span className="text-xs text-[--color-text-muted] uppercase tracking-wide min-w-[50px] text-right">Time</span>
              </div>
            </div>
            {enabledBreakpoints.map((bp, index) => {
              const split = completedSplits[index];
              const isNext = index === completedSplits.length;
              const isCompleted = index < completedSplits.length;

              // Use comparison splits if active, otherwise fall back to PB
              const compTime = hasComparison ? (comparisonSplits.get(bp.name) ?? null) : null;
              const pbTime = category ? (personalBests.get(`${category}-${cls}-${bp.name}`) ?? null) : null;
              const referenceTime = compTime ?? pbTime;

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
                  pbTime={referenceTime}
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
