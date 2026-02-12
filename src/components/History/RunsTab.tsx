import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useRunStore } from '../../stores/runStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { exportRunToJson } from '../../utils/jsonExport';
import { format } from 'date-fns';
import type { Run } from '../../types';

type SortField = 'startedAt' | 'totalTimeMs' | 'class' | 'category';
type SortDirection = 'asc' | 'desc';

export function RunsTab() {
  const { filteredRuns, loadFilteredRuns } = useRunStore();
  const { setCurrentView } = useSettingsStore();
  const [sortField, setSortField] = useState<SortField>('startedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sort runs
  const sortedRuns = [...filteredRuns].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'startedAt':
        comparison = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
        break;
      case 'totalTimeMs':
        comparison = (a.totalTimeMs ?? Infinity) - (b.totalTimeMs ?? Infinity);
        break;
      case 'class':
        comparison = a.class.localeCompare(b.class);
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleDelete = async (run: Run) => {
    try {
      await invoke('delete_run', { runId: run.id });
      loadFilteredRuns();
    } catch (error) {
      console.error('[RunsTab] Failed to delete run:', error);
    }
  };

  const handleViewSnapshots = (_run: Run) => {
    // TODO: Navigate to snapshots view with run selected
    setCurrentView('snapshots');
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDirection === 'asc' ? '^' : 'v'}</span>;
  };

  return (
    <div className="h-full flex flex-col bg-[--color-surface] rounded-lg overflow-hidden">
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[--color-surface]">
            <tr className="border-b border-[--color-border] text-[--color-text-muted] text-sm">
              <th
                className="p-3 text-left cursor-pointer hover:text-[--color-text]"
                onClick={() => handleSort('startedAt')}
              >
                Date
                <SortIcon field="startedAt" />
              </th>
              <th className="p-3 text-left">Character</th>
              <th
                className="p-3 text-left cursor-pointer hover:text-[--color-text]"
                onClick={() => handleSort('class')}
              >
                Class
                <SortIcon field="class" />
              </th>
              <th
                className="p-3 text-left cursor-pointer hover:text-[--color-text]"
                onClick={() => handleSort('category')}
              >
                Category
                <SortIcon field="category" />
              </th>
              <th
                className="p-3 text-right cursor-pointer hover:text-[--color-text]"
                onClick={() => handleSort('totalTimeMs')}
              >
                Time
                <SortIcon field="totalTimeMs" />
              </th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRuns.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[--color-text-muted]">
                  No runs found matching the current filters
                </td>
              </tr>
            ) : (
              sortedRuns.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-[--color-border] hover:bg-[--color-surface-elevated]"
                >
                  <td className="p-3 text-[--color-text-muted] text-sm">
                    {format(new Date(run.startedAt), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[--color-text]">
                        {run.characterName || run.character || 'Unknown'}
                      </span>
                      {run.isReference && (
                        <span className="px-1.5 py-0.5 text-xs bg-[--color-poe-gem]/20 text-[--color-poe-gem] rounded">
                          REF
                        </span>
                      )}
                      {run.isPersonalBest && (
                        <span className="px-1.5 py-0.5 text-xs bg-[--color-poe-gold]/20 text-[--color-poe-gold] rounded">
                          PB
                        </span>
                      )}
                    </div>
                    {run.sourceName && (
                      <div className="text-xs text-[--color-text-muted]">{run.sourceName}</div>
                    )}
                  </td>
                  <td className="p-3 text-[--color-text]">
                    {run.class}
                    {run.ascendancy && (
                      <span className="text-[--color-text-muted]"> / {run.ascendancy}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[--color-text]">{run.category}</span>
                      {run.breakpointPreset && (
                        <span className="px-1.5 py-0.5 text-xs bg-[--color-surface-elevated] text-[--color-text-muted] rounded">
                          {run.breakpointPreset}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right timer-display text-[--color-text]">
                    {run.totalTimeMs ? formatTime(run.totalTimeMs) : '--:--'}
                  </td>
                  <td className="p-3 text-center">
                    {run.isCompleted ? (
                      <span className="px-2 py-1 text-xs bg-[--color-timer-ahead]/20 text-[--color-timer-ahead] rounded">
                        Completed
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-[--color-poe-gold]/20 text-[--color-poe-gold] rounded">
                        In Progress
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleViewSnapshots(run)}
                        className="px-2 py-1 text-xs text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-elevated] rounded"
                        title="View snapshots"
                      >
                        View
                      </button>
                      <button
                        onClick={() => exportRunToJson(run.id, run)}
                        className="px-2 py-1 text-xs text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-elevated] rounded"
                        title="Export run as JSON"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => handleDelete(run)}
                        className="px-2 py-1 text-xs text-[--color-timer-behind] hover:bg-[--color-timer-behind]/20 rounded"
                        title="Delete run"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with count */}
      <div className="p-3 border-t border-[--color-border] text-sm text-[--color-text-muted]">
        {filteredRuns.length} run{filteredRuns.length !== 1 ? 's' : ''} found
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
