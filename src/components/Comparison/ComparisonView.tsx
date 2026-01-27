import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useRunStore } from '../../stores/runStore';
import { RunFilter } from '../Shared/RunFilter';
import type { Run, Split, RunFilters } from '../../types';

interface SplitComparison {
  breakpointName: string;
  leftSplit: Split | null;
  rightSplit: Split | null;
}

export function ComparisonView() {
  const { runs } = useRunStore();
  const [leftRunId, setLeftRunId] = useState<number | null>(null);
  const [rightRunId, setRightRunId] = useState<number | null>(null);
  const [leftSplits, setLeftSplits] = useState<Split[]>([]);
  const [rightSplits, setRightSplits] = useState<Split[]>([]);
  const [filters, setFilters] = useState<RunFilters>({});
  const [filteredRuns, setFilteredRuns] = useState<Run[]>([]);
  const [showSegmentTime, setShowSegmentTime] = useState(false);
  const [compatibleOnly, setCompatibleOnly] = useState(false);

  const leftRun = runs.find((r) => r.id === leftRunId);
  const rightRun = runs.find((r) => r.id === rightRunId);

  // Load filtered runs
  useEffect(() => {
    const loadRuns = async () => {
      try {
        const result = await invoke<Run[]>('get_runs_filtered', { filters });
        setFilteredRuns(result);
      } catch (error) {
        console.error('[ComparisonView] Failed to load filtered runs:', error);
        setFilteredRuns(runs);
      }
    };
    loadRuns();
  }, [filters, runs]);

  // Load splits when runs are selected
  useEffect(() => {
    const loadSplits = async () => {
      if (leftRunId) {
        try {
          const splits = await invoke<Split[]>('get_splits', { runId: leftRunId });
          setLeftSplits(splits);
        } catch (error) {
          console.error('[ComparisonView] Failed to load left splits:', error);
          setLeftSplits([]);
        }
      } else {
        setLeftSplits([]);
      }
    };
    loadSplits();
  }, [leftRunId]);

  useEffect(() => {
    const loadSplits = async () => {
      if (rightRunId) {
        try {
          const splits = await invoke<Split[]>('get_splits', { runId: rightRunId });
          setRightSplits(splits);
        } catch (error) {
          console.error('[ComparisonView] Failed to load right splits:', error);
          setRightSplits([]);
        }
      } else {
        setRightSplits([]);
      }
    };
    loadSplits();
  }, [rightRunId]);

  // Filter runs to only show compatible ones (same breakpoint preset)
  const displayRuns = useMemo(() => {
    if (!compatibleOnly || !leftRun) return filteredRuns;

    return filteredRuns.filter((r) => {
      if (!leftRun.breakpointPreset || !r.breakpointPreset) return true;
      return r.breakpointPreset === leftRun.breakpointPreset;
    });
  }, [filteredRuns, leftRun, compatibleOnly]);

  // Build comparison table data
  const comparisonData = useMemo<SplitComparison[]>(() => {
    // Get union of all breakpoint names from both runs
    const allBreakpoints = new Set<string>();
    leftSplits.forEach((s) => allBreakpoints.add(s.breakpointName));
    rightSplits.forEach((s) => allBreakpoints.add(s.breakpointName));

    // Create comparison rows
    const leftSplitMap = new Map(leftSplits.map((s) => [s.breakpointName, s]));
    const rightSplitMap = new Map(rightSplits.map((s) => [s.breakpointName, s]));

    // Sort by split time (use left run's order, then right run's unique ones)
    const sortedBreakpoints = [
      ...leftSplits.map((s) => s.breakpointName),
      ...rightSplits
        .filter((s) => !leftSplitMap.has(s.breakpointName))
        .map((s) => s.breakpointName),
    ];

    return sortedBreakpoints.map((name) => ({
      breakpointName: name,
      leftSplit: leftSplitMap.get(name) || null,
      rightSplit: rightSplitMap.get(name) || null,
    }));
  }, [leftSplits, rightSplits]);

  const handleFiltersChange = (newFilters: Partial<RunFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[--color-text]">Compare Runs</h1>
        <p className="text-[--color-text-muted] mt-1">
          Compare split times between two runs side by side
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <RunFilter
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClear={handleClearFilters}
          showPresetFilter={true}
          showReferenceToggle={true}
        />
      </div>

      {/* Run selectors */}
      <div className="flex gap-6 mb-4">
        <div className="flex-1">
          <label className="block text-sm text-[--color-text-muted] mb-2">Left Run</label>
          <select
            value={leftRunId ?? ''}
            onChange={(e) => setLeftRunId(e.target.value ? Number(e.target.value) : null)}
            className="w-full p-3 bg-[--color-surface] border border-[--color-border] rounded-lg text-[--color-text]"
          >
            <option value="">Select a run...</option>
            {displayRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {run.characterName || run.character} - {run.class}
                {run.ascendancy ? ` (${run.ascendancy})` : ''} - {formatTime(run.totalTimeMs ?? 0)}
                {run.isReference && ' [REF]'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm text-[--color-text-muted] mb-2">Right Run</label>
          <select
            value={rightRunId ?? ''}
            onChange={(e) => setRightRunId(e.target.value ? Number(e.target.value) : null)}
            className="w-full p-3 bg-[--color-surface] border border-[--color-border] rounded-lg text-[--color-text]"
          >
            <option value="">Select a run...</option>
            {displayRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {run.characterName || run.character} - {run.class}
                {run.ascendancy ? ` (${run.ascendancy})` : ''} - {formatTime(run.totalTimeMs ?? 0)}
                {run.isReference && ' [REF]'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Options */}
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-[--color-text]">
          <input
            type="checkbox"
            checked={showSegmentTime}
            onChange={(e) => setShowSegmentTime(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Show segment times (instead of cumulative)
        </label>
        <label className="flex items-center gap-2 text-sm text-[--color-text]">
          <input
            type="checkbox"
            checked={compatibleOnly}
            onChange={(e) => setCompatibleOnly(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Show compatible runs only (same preset)
        </label>
      </div>

      {/* Comparison content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {leftRun && rightRun ? (
          <>
            {/* Split comparison table */}
            <div className="flex-1 bg-[--color-surface] rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[--color-border]">
                <h2 className="font-semibold text-[--color-text]">Split Comparison</h2>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[--color-surface]">
                    <tr className="border-b border-[--color-border] text-[--color-text-muted] text-sm">
                      <th className="p-3 text-left">Split</th>
                      <th className="p-3 text-right">
                        {leftRun.characterName || leftRun.character}
                        {showSegmentTime && <span className="text-xs ml-1">(seg)</span>}
                      </th>
                      <th className="p-3 text-center">Delta</th>
                      <th className="p-3 text-right">
                        {rightRun.characterName || rightRun.character}
                        {showSegmentTime && <span className="text-xs ml-1">(seg)</span>}
                      </th>
                      <th className="p-3 text-right text-xs">Town</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row) => {
                      const leftTime = showSegmentTime
                        ? row.leftSplit?.segmentTimeMs
                        : row.leftSplit?.splitTimeMs;
                      const rightTime = showSegmentTime
                        ? row.rightSplit?.segmentTimeMs
                        : row.rightSplit?.splitTimeMs;
                      const delta =
                        leftTime !== undefined && rightTime !== undefined
                          ? leftTime - rightTime
                          : null;
                      const leftTownTime =
                        (row.leftSplit?.townTimeMs ?? 0) + (row.leftSplit?.hideoutTimeMs ?? 0);
                      const rightTownTime =
                        (row.rightSplit?.townTimeMs ?? 0) + (row.rightSplit?.hideoutTimeMs ?? 0);
                      const townDelta =
                        row.leftSplit && row.rightSplit ? leftTownTime - rightTownTime : null;

                      // Determine which run is faster for this split
                      const leftIsFaster = delta !== null && delta < 0;
                      const rightIsFaster = delta !== null && delta > 0;

                      return (
                        <tr key={row.breakpointName} className="border-b border-[--color-border]">
                          <td className="p-3 text-[--color-text]">{row.breakpointName}</td>
                          <td
                            className={`p-3 text-right timer-display ${
                              leftIsFaster
                                ? 'text-[--color-timer-ahead] font-semibold'
                                : 'text-[--color-text-muted]'
                            }`}
                          >
                            {leftTime !== undefined ? formatTime(leftTime) : '--:--'}
                          </td>
                          <td className="p-3 text-center timer-display">
                            {delta !== null ? (
                              <span
                                className={
                                  delta < 0
                                    ? 'text-[--color-timer-ahead]'
                                    : delta > 0
                                    ? 'text-[--color-timer-behind]'
                                    : 'text-[--color-timer-neutral]'
                                }
                              >
                                {formatDelta(delta)}
                              </span>
                            ) : (
                              <span className="text-[--color-text-muted]">--</span>
                            )}
                          </td>
                          <td
                            className={`p-3 text-right timer-display ${
                              rightIsFaster
                                ? 'text-[--color-timer-ahead] font-semibold'
                                : 'text-[--color-text-muted]'
                            }`}
                          >
                            {rightTime !== undefined ? formatTime(rightTime) : '--:--'}
                          </td>
                          <td className="p-3 text-right text-xs">
                            {townDelta !== null && townDelta !== 0 ? (
                              <span
                                className={
                                  townDelta < 0
                                    ? 'text-[--color-timer-ahead]'
                                    : 'text-[--color-timer-behind]'
                                }
                              >
                                {formatDelta(townDelta)}
                              </span>
                            ) : (
                              <span className="text-[--color-text-muted]">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[--color-surface-elevated]">
                      <td className="p-3 font-semibold text-[--color-text]">Total</td>
                      <td className="p-3 text-right timer-display text-[--color-text] font-semibold">
                        {formatTime(leftRun.totalTimeMs ?? 0)}
                      </td>
                      <td className="p-3 text-center timer-display">
                        {leftRun.totalTimeMs && rightRun.totalTimeMs && (
                          <span
                            className={
                              leftRun.totalTimeMs < rightRun.totalTimeMs
                                ? 'text-[--color-timer-ahead] font-semibold'
                                : leftRun.totalTimeMs > rightRun.totalTimeMs
                                ? 'text-[--color-timer-behind] font-semibold'
                                : 'text-[--color-timer-neutral]'
                            }
                          >
                            {formatDelta((leftRun.totalTimeMs ?? 0) - (rightRun.totalTimeMs ?? 0))}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right timer-display text-[--color-text] font-semibold">
                        {formatTime(rightRun.totalTimeMs ?? 0)}
                      </td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Run info sidebar */}
            <div className="w-80 bg-[--color-surface] rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[--color-border]">
                <h2 className="font-semibold text-[--color-text]">Run Details</h2>
              </div>
              <div className="p-4 space-y-4 overflow-auto">
                {/* Left run info */}
                <div className="p-3 bg-[--color-surface-elevated] rounded-lg">
                  <div className="text-xs text-[--color-text-muted] mb-1">
                    {leftRun.characterName || leftRun.character}
                  </div>
                  <div className="text-sm text-[--color-text]">
                    {leftRun.class}
                    {leftRun.ascendancy && ` / ${leftRun.ascendancy}`}
                  </div>
                  <div className="text-xs text-[--color-text-muted] mt-1">
                    {leftRun.league} - {leftRun.category}
                  </div>
                  {leftRun.breakpointPreset && (
                    <div className="text-xs text-[--color-poe-gold] mt-1">
                      Preset: {leftRun.breakpointPreset}
                    </div>
                  )}
                  {leftRun.isReference && (
                    <div className="text-xs text-[--color-poe-gem] mt-1">
                      Reference: {leftRun.sourceName}
                    </div>
                  )}
                </div>

                {/* Right run info */}
                <div className="p-3 bg-[--color-surface-elevated] rounded-lg">
                  <div className="text-xs text-[--color-text-muted] mb-1">
                    {rightRun.characterName || rightRun.character}
                  </div>
                  <div className="text-sm text-[--color-text]">
                    {rightRun.class}
                    {rightRun.ascendancy && ` / ${rightRun.ascendancy}`}
                  </div>
                  <div className="text-xs text-[--color-text-muted] mt-1">
                    {rightRun.league} - {rightRun.category}
                  </div>
                  {rightRun.breakpointPreset && (
                    <div className="text-xs text-[--color-poe-gold] mt-1">
                      Preset: {rightRun.breakpointPreset}
                    </div>
                  )}
                  {rightRun.isReference && (
                    <div className="text-xs text-[--color-poe-gem] mt-1">
                      Reference: {rightRun.sourceName}
                    </div>
                  )}
                </div>

                {/* Summary stats */}
                <div className="p-3 bg-[--color-surface-elevated] rounded-lg">
                  <div className="text-xs text-[--color-text-muted] mb-2">Summary</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[--color-text-muted]">Splits recorded</span>
                      <span className="text-[--color-text]">
                        {leftSplits.length} / {rightSplits.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[--color-text-muted]">Common splits</span>
                      <span className="text-[--color-text]">
                        {comparisonData.filter((r) => r.leftSplit && r.rightSplit).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[--color-text-muted]">Faster splits</span>
                      <span className="text-[--color-text]">
                        {
                          comparisonData.filter((r) => {
                            if (!r.leftSplit || !r.rightSplit) return false;
                            const leftTime = showSegmentTime
                              ? r.leftSplit.segmentTimeMs
                              : r.leftSplit.splitTimeMs;
                            const rightTime = showSegmentTime
                              ? r.rightSplit.segmentTimeMs
                              : r.rightSplit.splitTimeMs;
                            return leftTime < rightTime;
                          }).length
                        }{' '}
                        /{' '}
                        {
                          comparisonData.filter((r) => {
                            if (!r.leftSplit || !r.rightSplit) return false;
                            const leftTime = showSegmentTime
                              ? r.leftSplit.segmentTimeMs
                              : r.leftSplit.splitTimeMs;
                            const rightTime = showSegmentTime
                              ? r.rightSplit.segmentTimeMs
                              : r.rightSplit.splitTimeMs;
                            return rightTime < leftTime;
                          }).length
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 bg-[--color-surface] rounded-lg flex items-center justify-center text-[--color-text-muted]">
            Select two runs to compare
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

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDelta(ms: number): string {
  const sign = ms >= 0 ? '+' : '-';
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`;
}
