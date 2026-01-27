import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useRunStore } from '../../stores/runStore';
import { useSnapshotStore, parseItems, parsePassives, getEquippedItems } from '../../stores/snapshotStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { EquipmentGrid } from './EquipmentGrid';
import { SkillsDisplay } from './SkillsDisplay';
import { PassivesSummary } from './PassivesSummary';
import { PassiveTree } from './PassiveTree';
import { exportToPob, shareOnPobbIn } from '../../utils/pobExport';
import type { Run, Split, Snapshot } from '../../types';

interface SimulateResponse {
  run_id: number;
  split_id: number;
  snapshot_id: number;
}

type TabType = 'equipment' | 'passives';

export function SnapshotView() {
  const { runs, currentRun } = useRunStore();
  const {
    snapshots,
    selectedSnapshotId,
    pendingCaptures,
    failedCaptures,
    isLoading,
    loadSnapshots,
    selectSnapshot,
    retryCapture,
  } = useSnapshotStore();
  const { accountName } = useSettingsStore();

  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runSplits, setRunSplits] = useState<Split[]>([]);

  // Select current run by default if active
  useEffect(() => {
    if (currentRun && !selectedRunId) {
      setSelectedRunId(currentRun.id);
    }
  }, [currentRun, selectedRunId]);

  const selectedRun = runs.find((r) => r.id === selectedRunId) || currentRun;

  // Load snapshots when run is selected
  useEffect(() => {
    if (selectedRunId) {
      loadSnapshots(selectedRunId);
      // Also load splits for this run
      invoke<Split[]>('get_splits', { runId: selectedRunId })
        .then(setRunSplits)
        .catch(console.error);
    }
  }, [selectedRunId, loadSnapshots]);

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId);

  const [simStatus, setSimStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [simError, setSimError] = useState<string | null>(null);

  const handleDeleteRun = useCallback(async (runId: number) => {
    if (!confirm('Delete this run and all its snapshots?')) return;

    try {
      await invoke('delete_run', { runId });
      // Reload runs from store
      const updatedRuns = await invoke<Run[]>('get_runs');
      useRunStore.getState().setRuns(updatedRuns);
      // Clear selection if deleted run was selected
      if (selectedRunId === runId) {
        setSelectedRunId(null);
      }
    } catch (error) {
      console.error('Failed to delete run:', error);
      alert('Failed to delete run: ' + String(error));
    }
  }, [selectedRunId]);

  const handleSimulate = useCallback(async () => {
    const charName = prompt('Enter character name to simulate:', 'beerdz_');
    if (!charName) return;

    const acctName = accountName || prompt('Enter account name:', '');
    if (!acctName) return;

    setSimStatus('loading');
    setSimError(null);

    try {
      const result = await invoke<SimulateResponse>('simulate_snapshot', {
        request: {
          account_name: acctName,
          character_name: charName,
        },
      });
      console.log('[Simulate] Created:', result);
      setSimStatus('success');

      // Reload runs to show the new test run
      const updatedRuns = await invoke<Run[]>('get_runs');
      useRunStore.getState().setRuns(updatedRuns);

      // Select the new run
      setSelectedRunId(result.run_id);

      setTimeout(() => setSimStatus('idle'), 2000);
    } catch (error) {
      console.error('[Simulate] Failed:', error);
      setSimError(String(error));
      setSimStatus('error');
      setTimeout(() => setSimStatus('idle'), 5000);
    }
  }, [accountName]);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text]">Snapshots</h1>
          <p className="text-[--color-text-muted] mt-1">
            Browse character snapshots from your runs
          </p>
        </div>
        <button
          onClick={handleSimulate}
          disabled={simStatus === 'loading'}
          className="px-3 py-1.5 text-sm bg-[--color-surface-elevated] text-[--color-text-muted] rounded hover:bg-[--color-border] transition-colors disabled:opacity-50"
          title="Create a test snapshot from an existing POE character"
        >
          {simStatus === 'loading' ? 'Loading...' : simStatus === 'success' ? 'Created!' : '🧪 Simulate'}
        </button>
      </div>
      {simError && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-300 text-sm">
          {simError}
        </div>
      )}

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Run list */}
        <div className="w-80 bg-[--color-surface] rounded-lg overflow-hidden flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-[--color-border]">
            <h2 className="font-semibold text-[--color-text]">Runs</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {runs.length === 0 && !currentRun ? (
              <div className="p-4 text-center text-[--color-text-muted]">
                <p>No runs yet.</p>
                <p className="text-sm mt-1">Complete a run to see snapshots.</p>
              </div>
            ) : (
              <div className="divide-y divide-[--color-border]">
                {/* Current run first if active */}
                {currentRun && !currentRun.isCompleted && (
                  <RunListItem
                    run={currentRun}
                    isSelected={selectedRunId === currentRun.id}
                    onClick={() => setSelectedRunId(currentRun.id)}
                    isActive
                  />
                )}
                {runs.map((run) => (
                  <RunListItem
                    key={run.id}
                    run={run}
                    isSelected={selectedRunId === run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    onDelete={() => handleDeleteRun(run.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Snapshot detail */}
        <div className="flex-1 bg-[--color-surface] rounded-lg overflow-hidden flex flex-col min-w-0">
          {selectedRun ? (
            <SnapshotDetail
              run={selectedRun}
              splits={runSplits}
              snapshots={snapshots}
              selectedSnapshot={selectedSnapshot}
              pendingCaptures={pendingCaptures}
              failedCaptures={failedCaptures}
              isLoading={isLoading}
              onSelectSnapshot={selectSnapshot}
              onRetryCapture={(splitId, elapsedTimeMs) => {
                if (accountName && selectedRun.characterName) {
                  retryCapture(
                    selectedRun.id,
                    splitId,
                    elapsedTimeMs,
                    accountName,
                    selectedRun.characterName
                  );
                }
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[--color-text-muted]">
              Select a run to view snapshots
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RunListItemProps {
  run: Run;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: () => void;
  isActive?: boolean;
}

function RunListItem({ run, isSelected, onClick, onDelete, isActive }: RunListItemProps) {
  return (
    <div
      className={`w-full p-4 text-left hover:bg-[--color-surface-elevated] transition-colors cursor-pointer ${
        isSelected ? 'bg-[--color-surface-elevated]' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-[--color-text] truncate">
            {run.characterName || run.character || 'Unknown'}
          </span>
          {isActive && (
            <span className="text-xs px-1.5 py-0.5 bg-green-600/30 text-green-400 rounded shrink-0">
              Active
            </span>
          )}
        </div>
        {onDelete && !isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-[--color-text-muted] hover:text-red-400 hover:bg-red-400/10 rounded shrink-0"
            title="Delete run"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
      <div className="text-sm text-[--color-text-muted]">
        {run.ascendancy || run.class} {run.league && `- ${run.league}`}
      </div>
      <div className="text-xs text-[--color-text-muted] mt-1">
        {run.totalTimeMs ? formatTime(run.totalTimeMs) : 'In Progress'}
        {run.isPersonalBest && (
          <span className="ml-2 text-[--color-timer-gold]">PB</span>
        )}
      </div>
    </div>
  );
}

interface SnapshotDetailProps {
  run: Run;
  splits: Split[];
  snapshots: Snapshot[];
  selectedSnapshot?: Snapshot;
  pendingCaptures: Set<number>;
  failedCaptures: Map<number, string>;
  isLoading: boolean;
  onSelectSnapshot: (id: number | null) => void;
  onRetryCapture: (splitId: number, elapsedTimeMs: number) => void;
}

function SnapshotDetail({
  run,
  splits,
  snapshots,
  selectedSnapshot,
  pendingCaptures,
  failedCaptures,
  isLoading,
  onSelectSnapshot,
  onRetryCapture,
}: SnapshotDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('equipment');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleExportToPob = async () => {
    if (!selectedSnapshot) return;
    setExportStatus('loading');
    try {
      await exportToPob(selectedSnapshot, run);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  };

  const handleShareOnPobbIn = async () => {
    if (!selectedSnapshot) return;
    setShareStatus('loading');
    try {
      const url = await shareOnPobbIn(selectedSnapshot, run);
      setShareUrl(url);
      setShareStatus('success');
      // Open in browser
      window.open(url, '_blank');
    } catch (error) {
      console.error('Share failed:', error);
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 3000);
    }
  };

  // Parse snapshot data
  const items = useMemo(() => {
    if (!selectedSnapshot?.itemsJson) return [];
    return parseItems(selectedSnapshot.itemsJson);
  }, [selectedSnapshot]);

  const equippedItems = useMemo(() => {
    return getEquippedItems(items);
  }, [items]);

  const passives = useMemo(() => {
    if (!selectedSnapshot) return { hashes: [], hashesEx: [], masteryEffects: {} };
    return parsePassives(selectedSnapshot.passiveTreeJson);
  }, [selectedSnapshot]);

  // Create timeline markers from splits
  const timelineMarkers = useMemo(() => {
    return splits.map((split) => {
      const snapshot = snapshots.find((s) => s.splitId === split.id);
      const isPending = pendingCaptures.has(split.id);
      const failError = failedCaptures.get(split.id);

      return {
        split,
        snapshot,
        isPending,
        failError,
      };
    });
  }, [splits, snapshots, pendingCaptures, failedCaptures]);

  const maxTime = run.totalTimeMs || splits[splits.length - 1]?.splitTimeMs || 1;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-[--color-border]">
        <h2 className="text-xl font-semibold text-[--color-text]">
          {run.characterName || run.character || 'Unknown'}
        </h2>
        <p className="text-[--color-text-muted]">
          {run.class} {run.league && `- ${run.league}`}
        </p>
      </div>

      {/* Timeline scrubber */}
      <div className="px-6 py-4 border-b border-[--color-border]">
        <div className="text-sm text-[--color-text-muted] mb-2">
          Snapshot Timeline
          {isLoading && <span className="ml-2 text-[--color-poe-gold]">Loading...</span>}
        </div>
        <div className="relative h-8 bg-[--color-surface-elevated] rounded-full">
          {/* Progress bar */}
          {selectedSnapshot && (
            <div
              className="absolute h-full bg-[--color-poe-gold]/20 rounded-full"
              style={{ width: `${(selectedSnapshot.elapsedTimeMs / maxTime) * 100}%` }}
            />
          )}

          {/* Timeline markers */}
          {timelineMarkers.map((marker) => {
            const position = (marker.split.splitTimeMs / maxTime) * 100;
            const isSelected = marker.snapshot?.id === selectedSnapshot?.id;

            return (
              <button
                key={marker.split.id}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all
                  ${
                    marker.isPending
                      ? 'bg-yellow-500 border-yellow-400 animate-pulse'
                      : marker.failError
                      ? 'bg-red-500 border-red-400 cursor-pointer'
                      : marker.snapshot
                      ? isSelected
                        ? 'bg-[--color-poe-gold] border-[--color-poe-gold-light] scale-125'
                        : 'bg-[--color-poe-gold] border-[--color-poe-gold-light] hover:scale-110'
                      : 'bg-[--color-border] border-[--color-text-muted]'
                  }
                `}
                style={{ left: `${position}%` }}
                onClick={() => {
                  if (marker.failError) {
                    onRetryCapture(marker.split.id, marker.split.splitTimeMs);
                  } else if (marker.snapshot) {
                    onSelectSnapshot(marker.snapshot.id);
                  }
                }}
                title={`${marker.split.breakpointName}\n${formatTime(marker.split.splitTimeMs)}${
                  marker.isPending
                    ? '\nCapturing...'
                    : marker.failError
                    ? `\nFailed: ${marker.failError}\nClick to retry`
                    : marker.snapshot
                    ? `\nLevel ${marker.snapshot.characterLevel}`
                    : '\nNo snapshot'
                }`}
              />
            );
          })}
        </div>

        {/* Timeline labels */}
        <div className="flex justify-between mt-2 text-xs text-[--color-text-muted]">
          <span>Start</span>
          <span>{selectedSnapshot ? `${formatTime(selectedSnapshot.elapsedTimeMs)} - Level ${selectedSnapshot.characterLevel}` : ''}</span>
          <span>{formatTime(maxTime)}</span>
        </div>
      </div>

      {/* Content area */}
      {snapshots.length === 0 && !isLoading ? (
        <div className="flex-1 flex items-center justify-center text-[--color-text-muted]">
          <div className="text-center">
            <p className="mb-2">No snapshots captured yet.</p>
            <p className="text-sm">
              Snapshots are automatically captured at act transitions and boss kills.
            </p>
          </div>
        </div>
      ) : selectedSnapshot ? (
        <>
          {/* Tabs */}
          <div className="px-6 border-b border-[--color-border]">
            <div className="flex gap-4">
              {(['equipment', 'passives'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 px-1 text-sm border-b-2 transition-colors capitalize ${
                    activeTab === tab
                      ? 'text-[--color-text] border-[--color-poe-gold]'
                      : 'text-[--color-text-muted] border-transparent hover:text-[--color-text] hover:border-[--color-poe-gold]/50'
                  }`}
                >
                  {tab === 'equipment' ? 'Gear & Skills' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-6">
            {activeTab === 'equipment' && (
              <div className="grid grid-cols-[auto_1fr_1fr] gap-6">
                {/* Equipment grid - column 1 */}
                <div className="shrink-0">
                  <EquipmentGrid items={equippedItems} />
                </div>
                {/* Skills panel - columns 2 & 3 */}
                <div className="col-span-2">
                  <div className="text-sm text-[#6a6a8a] mb-3">Socketed Gems</div>
                  <SkillsDisplay items={items} compact columns={2} />
                </div>
              </div>
            )}
            {activeTab === 'passives' && (
              <div className="space-y-4">
                <PassiveTree
                  allocatedNodes={passives.hashes}
                  masterySelections={passives.masteryEffects}
                  characterClass={run.class}
                  ascendancy={run.ascendancy || undefined}
                  width={Math.min(900, window.innerWidth - 450)}
                  height={550}
                />
                <PassivesSummary
                  hashes={passives.hashes}
                  hashesEx={passives.hashesEx}
                  characterLevel={selectedSnapshot.characterLevel}
                />
              </div>
            )}
          </div>

          {/* Export buttons */}
          <div className="p-6 pt-0 flex gap-3 items-center">
            <button
              className="px-4 py-2 bg-[--color-poe-gold] text-[--color-poe-darker] rounded-lg font-medium hover:bg-[--color-poe-gold-light] transition-colors disabled:opacity-50"
              onClick={handleExportToPob}
              disabled={exportStatus === 'loading'}
            >
              {exportStatus === 'loading' ? 'Copying...' : exportStatus === 'success' ? 'Copied!' : 'Export to PoB'}
            </button>
            <button
              className="px-4 py-2 bg-[--color-surface-elevated] text-[--color-text] rounded-lg font-medium hover:bg-[--color-border] transition-colors disabled:opacity-50"
              onClick={handleShareOnPobbIn}
              disabled={shareStatus === 'loading'}
            >
              {shareStatus === 'loading' ? 'Uploading...' : shareStatus === 'success' ? 'Shared!' : 'Share on pobb.in'}
            </button>
            {shareStatus === 'success' && shareUrl && (
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[--color-poe-gold] hover:underline"
              >
                {shareUrl}
              </a>
            )}
            {(exportStatus === 'error' || shareStatus === 'error') && (
              <span className="text-sm text-red-400">Failed - check console</span>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[--color-text-muted]">
          Select a snapshot from the timeline
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

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
