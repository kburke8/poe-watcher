import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GitCompareArrows } from 'lucide-react';
import { useRunStore } from '../../stores/runStore';
import { RunFilter } from '../Shared/RunFilter';
import { CustomSelect } from '../Shared/CustomSelect';
import { EmptyState } from '../Shared/EmptyState';
import { ComparisonCharts } from './ComparisonCharts';
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
  const [filters, setFilters] = useState<RunFilters>({ includeReference: true });
  const [filteredRuns, setFilteredRuns] = useState<Run[]>([]);
  const [showSegmentTime, setShowSegmentTime] = useState(false);
  const [compatibleOnly, setCompatibleOnly] = useState(false);

  const leftRun = filteredRuns.find((r) => r.id === leftRunId) || runs.find((r) => r.id === leftRunId);
  const rightRun = filteredRuns.find((r) => r.id === rightRunId) || runs.find((r) => r.id === rightRunId);
  const hasRefRun = leftRun?.isReference || rightRun?.isReference;

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

  // Compute biggest wins/losses by segment time
  const keyDifferences = useMemo(() => {
    const commonRows = comparisonData.filter(r => r.leftSplit && r.rightSplit);
    if (commonRows.length === 0) return null;

    const diffs = commonRows
      .map(r => ({
        name: r.breakpointName,
        segDelta: r.leftSplit!.segmentTimeMs - r.rightSplit!.segmentTimeMs,
      }))
      .sort((a, b) => a.segDelta - b.segDelta); // negative = left faster

    return {
      gains: diffs.slice(0, 3),
      losses: diffs.slice(-3).reverse(),
    };
  }, [comparisonData]);

  const getRunLabel = (run: Run) => {
    if (run.isReference) {
      return `${run.sourceName || 'Reference'} - ${formatTime(run.totalTimeMs ?? 0)} [REF]`;
    }
    return `${run.characterName || run.character} - ${run.class}${run.ascendancy ? ` (${run.ascendancy})` : ''} - ${formatTime(run.totalTimeMs ?? 0)}`;
  };

  const handleFiltersChange = (newFilters: Partial<RunFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleClearFilters = () => {
    setFilters({ includeReference: true });
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
          <CustomSelect
            value={leftRunId != null ? String(leftRunId) : ''}
            onChange={(v) => setLeftRunId(v ? Number(v) : null)}
            className="p-3"
            placeholder="Select a run..."
            options={[
              { value: '', label: 'Select a run...' },
              ...displayRuns.map((run) => ({
                value: String(run.id),
                label: getRunLabel(run),
              })),
            ]}
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm text-[--color-text-muted] mb-2">Right Run</label>
          <CustomSelect
            value={rightRunId != null ? String(rightRunId) : ''}
            onChange={(v) => setRightRunId(v ? Number(v) : null)}
            className="p-3"
            placeholder="Select a run..."
            options={[
              { value: '', label: 'Select a run...' },
              ...displayRuns.map((run) => ({
                value: String(run.id),
                label: getRunLabel(run),
              })),
            ]}
          />
        </div>
      </div>

      {/* Options - run filter only */}
      <div className="flex gap-4 mb-4">
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

      {/* Scrollable content area: charts + table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* Charts */}
        {leftRun && rightRun && comparisonData.length > 0 && (
          <ComparisonCharts
            comparisonData={comparisonData}
            leftRun={leftRun}
            rightRun={rightRun}
          />
        )}

        {/* Comparison content */}
        <div className="flex gap-6" style={{ minHeight: '400px' }}>
          {leftRun && rightRun ? (
            <>
              {/* Split comparison table */}
              <div className="flex-1 card-inset rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[--color-border] flex items-center justify-between">
                <h2 className="font-semibold text-[--color-text]">Split Comparison</h2>
                <label className="flex items-center gap-2 text-xs text-[--color-text-muted]">
                  <input
                    type="checkbox"
                    checked={showSegmentTime}
                    onChange={(e) => setShowSegmentTime(e.target.checked)}
                    className="w-3.5 h-3.5 rounded"
                  />
                  Segment times
                </label>
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
                      <th className="p-3 text-right text-xs">Boss</th>
                      <th className="p-3 text-right text-xs">Town +/-</th>
                      <th className="p-3 text-center text-xs">Deaths</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.map((row, idx) => {
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

                      // Per-segment deaths (derived from cumulative)
                      const prevLeft = idx > 0 ? comparisonData[idx - 1].leftSplit : null;
                      const prevRight = idx > 0 ? comparisonData[idx - 1].rightSplit : null;
                      const leftDeaths = row.leftSplit
                        ? (row.leftSplit.deathCount ?? 0) - (prevLeft?.deathCount ?? 0)
                        : null;
                      const rightDeaths = row.rightSplit
                        ? (row.rightSplit.deathCount ?? 0) - (prevRight?.deathCount ?? 0)
                        : null;

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
                            {(() => {
                              const leftBoss = row.leftSplit?.bossFightMs ?? 0;
                              const rightBoss = row.rightSplit?.bossFightMs ?? 0;
                              if (leftBoss === 0 && rightBoss === 0) {
                                return <span className="text-[--color-text-muted]">-</span>;
                              }
                              const bossDelta = leftBoss > 0 && rightBoss > 0 ? leftBoss - rightBoss : null;
                              return (
                                <span className="flex justify-end gap-1">
                                  <span className={bossDelta !== null && bossDelta < 0 ? 'text-[--color-timer-ahead] timer-display' : 'text-[--color-text-muted] timer-display'}>
                                    {leftBoss > 0 ? formatTime(leftBoss) : '-'}
                                  </span>
                                  <span className="text-[--color-text-muted]">/</span>
                                  <span className={bossDelta !== null && bossDelta > 0 ? 'text-[--color-timer-ahead] timer-display' : 'text-[--color-text-muted] timer-display'}>
                                    {rightBoss > 0 ? formatTime(rightBoss) : '-'}
                                  </span>
                                </span>
                              );
                            })()}
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
                          <td className="p-3 text-center text-xs">
                            {(leftDeaths !== null || rightDeaths !== null || hasRefRun) ? (
                              <span className="flex justify-center gap-1">
                                <span className={!leftRun?.isReference && leftDeaths && leftDeaths > 0 ? 'text-red-400' : 'text-[--color-text-muted]'}>
                                  {leftRun?.isReference ? 'N/A' : (leftDeaths ?? '-')}
                                </span>
                                <span className="text-[--color-text-muted]">/</span>
                                <span className={!rightRun?.isReference && rightDeaths && rightDeaths > 0 ? 'text-red-400' : 'text-[--color-text-muted]'}>
                                  {rightRun?.isReference ? 'N/A' : (rightDeaths ?? '-')}
                                </span>
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
                      <td className="p-3 text-right text-xs">
                        {(() => {
                          const leftBossTotal = leftSplits.reduce((sum, s) => sum + (s.bossFightMs ?? 0), 0);
                          const rightBossTotal = rightSplits.reduce((sum, s) => sum + (s.bossFightMs ?? 0), 0);
                          if (leftBossTotal === 0 && rightBossTotal === 0) return null;
                          return (
                            <span className="flex justify-end gap-1 timer-display">
                              <span className="text-[--color-text]">{leftBossTotal > 0 ? formatTime(leftBossTotal) : '-'}</span>
                              <span className="text-[--color-text-muted]">/</span>
                              <span className="text-[--color-text]">{rightBossTotal > 0 ? formatTime(rightBossTotal) : '-'}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-3 text-right text-xs">
                        {(() => {
                          const leftTownTotal = leftSplits.length > 0
                            ? (leftSplits[leftSplits.length - 1].townTimeMs ?? 0) + (leftSplits[leftSplits.length - 1].hideoutTimeMs ?? 0)
                            : 0;
                          const rightTownTotal = rightSplits.length > 0
                            ? (rightSplits[rightSplits.length - 1].townTimeMs ?? 0) + (rightSplits[rightSplits.length - 1].hideoutTimeMs ?? 0)
                            : 0;
                          const totalTownDelta = leftTownTotal - rightTownTotal;
                          if (totalTownDelta === 0) return null;
                          return (
                            <span className={totalTownDelta < 0 ? 'text-[--color-timer-ahead]' : 'text-[--color-timer-behind]'}>
                              {formatDelta(totalTownDelta)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-3 text-center text-xs">
                        {(leftSplits.length > 0 || rightSplits.length > 0 || hasRefRun) ? (
                          <span className="flex justify-center gap-1">
                            <span className={!leftRun?.isReference && (leftSplits[leftSplits.length - 1]?.deathCount ?? 0) > 0 ? 'text-red-400' : 'text-[--color-text-muted]'}>
                              {leftRun?.isReference ? 'N/A' : (leftSplits[leftSplits.length - 1]?.deathCount ?? 0)}
                            </span>
                            <span className="text-[--color-text-muted]">/</span>
                            <span className={!rightRun?.isReference && (rightSplits[rightSplits.length - 1]?.deathCount ?? 0) > 0 ? 'text-red-400' : 'text-[--color-text-muted]'}>
                              {rightRun?.isReference ? 'N/A' : (rightSplits[rightSplits.length - 1]?.deathCount ?? 0)}
                            </span>
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Run info sidebar */}
            <div className="w-80 card-inset rounded-lg overflow-hidden flex flex-col">
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
                  {leftSplits.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-[--color-border] text-xs">
                      <span className="text-yellow-400/70">Town: <span className="timer-display text-[--color-text]">{formatTime(leftSplits[leftSplits.length - 1].townTimeMs ?? 0)}</span></span>
                      <span className="text-blue-400/70">Hideout: <span className="timer-display text-[--color-text]">{formatTime(leftSplits[leftSplits.length - 1].hideoutTimeMs ?? 0)}</span></span>
                      {(leftSplits[leftSplits.length - 1]?.deathCount ?? 0) > 0 && (
                        <span className="text-red-400/70">Deaths: <span className="text-[--color-text]">{leftSplits[leftSplits.length - 1].deathCount}</span></span>
                      )}
                      {leftSplits.reduce((sum, s) => sum + (s.bossFightMs ?? 0), 0) > 0 && (
                        <span className="text-orange-400/70">Boss: <span className="timer-display text-[--color-text]">{formatTime(leftSplits.reduce((sum, s) => sum + (s.bossFightMs ?? 0), 0))}</span></span>
                      )}
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
                  {rightSplits.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-[--color-border] text-xs">
                      <span className="text-yellow-400/70">Town: <span className="timer-display text-[--color-text]">{formatTime(rightSplits[rightSplits.length - 1].townTimeMs ?? 0)}</span></span>
                      <span className="text-blue-400/70">Hideout: <span className="timer-display text-[--color-text]">{formatTime(rightSplits[rightSplits.length - 1].hideoutTimeMs ?? 0)}</span></span>
                      {(rightSplits[rightSplits.length - 1]?.deathCount ?? 0) > 0 && (
                        <span className="text-red-400/70">Deaths: <span className="text-[--color-text]">{rightSplits[rightSplits.length - 1].deathCount}</span></span>
                      )}
                      {rightSplits.reduce((sum, s) => sum + (s.bossFightMs ?? 0), 0) > 0 && (
                        <span className="text-orange-400/70">Boss: <span className="timer-display text-[--color-text]">{formatTime(rightSplits.reduce((sum, s) => sum + (s.bossFightMs ?? 0), 0))}</span></span>
                      )}
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

                {/* Key Differences */}
                {keyDifferences && (
                  <div className="p-3 bg-[--color-surface-elevated] rounded-lg">
                    <div className="text-xs text-[--color-text-muted] mb-2">Key Differences</div>
                    <div className="space-y-3">
                      {/* Biggest gains (left was faster) */}
                      {keyDifferences.gains.some(g => g.segDelta < 0) && (
                        <div>
                          <div className="text-xs text-[--color-timer-ahead] mb-1">
                            Biggest gains (left faster)
                          </div>
                          <div className="space-y-1">
                            {keyDifferences.gains
                              .filter(g => g.segDelta < 0)
                              .map(g => (
                                <div key={g.name} className="flex justify-between text-xs">
                                  <span className="text-[--color-text] truncate mr-2">{g.name}</span>
                                  <span className="text-[--color-timer-ahead] timer-display shrink-0">
                                    {formatDelta(g.segDelta)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      {/* Biggest losses (left was slower) */}
                      {keyDifferences.losses.some(l => l.segDelta > 0) && (
                        <div>
                          <div className="text-xs text-[--color-timer-behind] mb-1">
                            Biggest losses (left slower)
                          </div>
                          <div className="space-y-1">
                            {keyDifferences.losses
                              .filter(l => l.segDelta > 0)
                              .map(l => (
                                <div key={l.name} className="flex justify-between text-xs">
                                  <span className="text-[--color-text] truncate mr-2">{l.name}</span>
                                  <span className="text-[--color-timer-behind] timer-display shrink-0">
                                    {formatDelta(l.segDelta)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 card-inset rounded-lg flex items-center justify-center">
            <EmptyState icon={GitCompareArrows} title="Select two runs" description="Choose runs from the dropdowns above to compare split times." />
          </div>
        )}
        </div>
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
