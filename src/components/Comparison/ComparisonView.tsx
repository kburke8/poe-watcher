import { useState } from 'react';
import { useRunStore } from '../../stores/runStore';

export function ComparisonView() {
  const { runs } = useRunStore();
  const [leftRunId, setLeftRunId] = useState<number | null>(null);
  const [rightRunId, setRightRunId] = useState<number | null>(null);

  const leftRun = runs.find((r) => r.id === leftRunId);
  const rightRun = runs.find((r) => r.id === rightRunId);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[--color-text]">Compare Runs</h1>
        <p className="text-[--color-text-muted] mt-1">
          Compare two runs side by side
        </p>
      </div>

      {/* Run selectors */}
      <div className="flex gap-6 mb-6">
        <div className="flex-1">
          <label className="block text-sm text-[--color-text-muted] mb-2">Left Run</label>
          <select
            value={leftRunId ?? ''}
            onChange={(e) => setLeftRunId(e.target.value ? Number(e.target.value) : null)}
            className="w-full p-3 bg-[--color-surface] border border-[--color-border] rounded-lg text-[--color-text]"
          >
            <option value="">Select a run...</option>
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.characterName} - {run.class} ({formatTime(run.totalTimeMs ?? 0)})
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
            {runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.characterName} - {run.class} ({formatTime(run.totalTimeMs ?? 0)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison content */}
      <div className="flex-1 flex gap-6">
        {leftRun && rightRun ? (
          <>
            {/* Split comparison table */}
            <div className="flex-1 bg-[--color-surface] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-[--color-border]">
                <h2 className="font-semibold text-[--color-text]">Split Comparison</h2>
              </div>
              <div className="overflow-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[--color-border] text-[--color-text-muted] text-sm">
                      <th className="p-3 text-left">Split</th>
                      <th className="p-3 text-right">{leftRun.characterName}</th>
                      <th className="p-3 text-center">Delta</th>
                      <th className="p-3 text-right">{rightRun.characterName}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Placeholder rows */}
                    {['Act 1', 'Act 2', 'Act 3', 'Act 4', 'Act 5', 'Act 6', 'Act 7', 'Act 8', 'Act 9', 'Act 10'].map((split) => (
                      <tr key={split} className="border-b border-[--color-border]">
                        <td className="p-3 text-[--color-text]">{split}</td>
                        <td className="p-3 text-right timer-display text-[--color-text-muted]">--:--</td>
                        <td className="p-3 text-center timer-display text-[--color-timer-neutral]">--</td>
                        <td className="p-3 text-right timer-display text-[--color-text-muted]">--:--</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[--color-surface-elevated]">
                      <td className="p-3 font-semibold text-[--color-text]">Total</td>
                      <td className="p-3 text-right timer-display text-[--color-text]">
                        {formatTime(leftRun.totalTimeMs ?? 0)}
                      </td>
                      <td className="p-3 text-center timer-display">
                        {leftRun.totalTimeMs && rightRun.totalTimeMs && (
                          <span className={leftRun.totalTimeMs < rightRun.totalTimeMs ? 'text-[--color-timer-ahead]' : 'text-[--color-timer-behind]'}>
                            {formatDelta((leftRun.totalTimeMs ?? 0) - (rightRun.totalTimeMs ?? 0))}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right timer-display text-[--color-text]">
                        {formatTime(rightRun.totalTimeMs ?? 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Build comparison */}
            <div className="w-80 bg-[--color-surface] rounded-lg overflow-hidden">
              <div className="p-4 border-b border-[--color-border]">
                <h2 className="font-semibold text-[--color-text]">Build Differences</h2>
              </div>
              <div className="p-4">
                <p className="text-[--color-text-muted] text-sm">
                  Select a specific split to compare builds at that point.
                </p>
                <div className="mt-4 space-y-3">
                  <div className="p-3 bg-[--color-surface-elevated] rounded-lg">
                    <div className="text-xs text-[--color-text-muted]">Level Difference</div>
                    <div className="text-lg text-[--color-text]">--</div>
                  </div>
                  <div className="p-3 bg-[--color-surface-elevated] rounded-lg">
                    <div className="text-xs text-[--color-text-muted]">DPS Difference</div>
                    <div className="text-lg text-[--color-text]">--</div>
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
