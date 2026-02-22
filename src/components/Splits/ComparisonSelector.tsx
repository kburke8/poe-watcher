import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Plus, X, Pencil } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { CustomSelect } from '../Shared/CustomSelect';
import { AddComparisonModal } from './AddComparisonModal';
import type { Run, Split, RunFilters } from '../../types';

export function ComparisonSelector() {
  const { activeComparisonRunId, setActiveComparison } = useSettingsStore();
  const [availableRuns, setAvailableRuns] = useState<Run[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRun, setEditingRun] = useState<Run | null>(null);
  const [editingSplits, setEditingSplits] = useState<Split[]>([]);

  const loadRuns = useCallback(async () => {
    try {
      const filters: RunFilters = {
        status: 'completed',
        includeReference: true,
      };
      const runs = await invoke<Run[]>('get_runs_filtered', { filters });
      setAvailableRuns(runs);
    } catch (error) {
      console.error('[ComparisonSelector] Failed to load runs:', error);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleChange = (value: string) => {
    if (!value) {
      setActiveComparison(null, null);
      return;
    }
    const runId = Number(value);
    const run = availableRuns.find(r => r.id === runId);
    const label = run
      ? (run.isReference && run.sourceName
          ? run.sourceName
          : `${run.characterName || run.character || 'Run'} (${formatTime(run.totalTimeMs ?? 0)})`)
      : null;
    setActiveComparison(runId, label);
  };

  const handleClear = () => {
    setActiveComparison(null, null);
  };

  const handleModalSuccess = () => {
    loadRuns();
  };

  const activeRun = availableRuns.find(r => r.id === activeComparisonRunId);
  const canEdit = activeRun?.isReference;

  const handleEdit = async () => {
    if (!activeRun) return;
    try {
      const splits = await invoke<Split[]>('get_splits', { runId: activeRun.id });
      setEditingSplits(splits);
      setEditingRun(activeRun);
    } catch (error) {
      console.error('[ComparisonSelector] Failed to load splits for editing:', error);
    }
  };

  const options = [
    { value: '', label: 'Personal Best' },
    ...availableRuns.map(run => ({
      value: String(run.id),
      label: `${run.isReference ? '[REF] ' : ''}${run.sourceName || run.characterName || run.character || 'Run'} - ${formatTime(run.totalTimeMs ?? 0)}`,
    })),
  ];

  return (
    <>
      <div className="px-4 py-2 border-b border-[--color-border] flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <label className="block text-[10px] text-[--color-text-muted] uppercase tracking-wide mb-1">Compare vs</label>
          <CustomSelect
            value={activeComparisonRunId != null ? String(activeComparisonRunId) : ''}
            onChange={handleChange}
            options={options}
            placeholder="Personal Best"
          />
        </div>
        {activeComparisonRunId != null && canEdit && (
          <button
            onClick={handleEdit}
            className="mt-4 p-1 rounded text-[--color-text-muted] hover:text-[--color-poe-gold] hover:bg-[--color-surface-elevated] transition-colors"
            title="Edit comparison run"
          >
            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        )}
        {activeComparisonRunId != null && (
          <button
            onClick={handleClear}
            className="mt-4 p-1 rounded text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-elevated] transition-colors"
            title="Clear comparison"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        )}
        <button
          onClick={() => setShowAddModal(true)}
          className="mt-4 p-1 rounded text-[--color-text-muted] hover:text-[--color-poe-gold] hover:bg-[--color-surface-elevated] transition-colors"
          title="Add comparison run"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>

      <AddComparisonModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleModalSuccess}
      />

      {editingRun && (
        <AddComparisonModal
          isOpen={!!editingRun}
          onClose={() => { setEditingRun(null); setEditingSplits([]); }}
          onSuccess={() => { setEditingRun(null); setEditingSplits([]); loadRuns(); }}
          editRunId={editingRun.id}
          editRun={editingRun}
          editSplits={editingSplits}
        />
      )}
    </>
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
