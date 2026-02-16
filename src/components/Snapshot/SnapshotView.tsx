import { useState, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Camera, MousePointerClick } from 'lucide-react';
import { useRunStore } from '../../stores/runStore';
import { useSnapshotStore, parseItems, parsePassives, getEquippedItems } from '../../stores/snapshotStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { EquipmentGrid } from './EquipmentGrid';
import { SkillsDisplay } from './SkillsDisplay';
import { PassivesSummary } from './PassivesSummary';
import { PassiveTree } from './PassiveTree';
import { EmptyState } from '../Shared/EmptyState';
import { LoadingSpinner } from '../Shared/LoadingSpinner';
import { Button } from '../Shared/Button';
import { exportToPob, shareOnPobbIn, exportAllToPob, shareAllOnPobbIn } from '../../utils/pobExport';
import { exportRunToJson } from '../../utils/jsonExport';
import type { Run, Split, Snapshot } from '../../types';

type TabType = 'equipment' | 'passives';

export function SnapshotView() {
  const { runs: rawRuns, currentRun } = useRunStore();

  // Deduplicate runs by ID to prevent React key errors
  const runs = useMemo(() => {
    const seen = new Set<number>();
    return rawRuns.filter((run) => {
      if (seen.has(run.id)) return false;
      seen.add(run.id);
      return true;
    });
  }, [rawRuns]);
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
  const { accountName, pendingSnapshotRunId } = useSettingsStore();

  const [selectedRunId, setSelectedRunId] = useState<number | null>(pendingSnapshotRunId);
  const [runSplits, setRunSplits] = useState<Split[]>([]);

  // Load runs on mount
  useEffect(() => {
    invoke<Run[]>('get_runs')
      .then((loadedRuns) => {
        useRunStore.getState().setRuns(loadedRuns);
      })
      .catch(console.error);
  }, []);

  // Select current run by default if active (only when no pending navigation)
  useEffect(() => {
    if (currentRun && !selectedRunId && !pendingSnapshotRunId) {
      setSelectedRunId(currentRun.id);
    }
  }, [currentRun, selectedRunId, pendingSnapshotRunId]);

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

  const handleDeleteRun = useCallback(async (runId: number) => {
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

  const handleDeleteAll = useCallback(async () => {
    try {
      // Delete all runs (except active current run)
      for (const run of runs) {
        if (!currentRun || run.id !== currentRun.id || currentRun.isCompleted) {
          await invoke('delete_run', { runId: run.id });
        }
      }
      // Reload runs from store
      const updatedRuns = await invoke<Run[]>('get_runs');
      useRunStore.getState().setRuns(updatedRuns);
      setSelectedRunId(null);
    } catch (error) {
      console.error('Failed to delete all runs:', error);
      alert('Failed to delete all runs: ' + String(error));
    }
  }, [runs, currentRun]);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text]">Snapshots</h1>
          <p className="text-[--color-text-muted] mt-1">
            Browse character snapshots from your runs
          </p>
        </div>
      </div>
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Run list */}
        <div className="w-80 card-inset rounded-lg overflow-hidden flex flex-col flex-shrink-0">
          <div className="p-4 section-header rounded-t-lg flex items-center justify-between">
            <h2 className="font-semibold text-[--color-text]">Runs</h2>
            {runs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteAll}
                title="Delete all runs"
              >
                Delete All
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {runs.length === 0 && !currentRun ? (
              <EmptyState icon={Camera} title="No runs yet" description="Complete a run to see snapshots." />
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
        <div className="flex-1 card-inset rounded-lg overflow-hidden flex flex-col min-w-0">
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
            <div className="h-full flex items-center justify-center">
              <EmptyState icon={MousePointerClick} title="Select a run" description="Choose a run from the list to view its snapshots." />
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
      className={`w-full p-4 text-left transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'bg-[--color-surface-elevated]'
          : 'hover:bg-[--color-surface-elevated]/70'
      }`}
      style={
        isSelected
          ? { borderLeft: '3px solid var(--color-poe-gold)', paddingLeft: '13px', boxShadow: 'inset 4px 0 8px -4px rgba(175, 96, 37, 0.3)' }
          : { borderLeft: '3px solid transparent', paddingLeft: '13px' }
      }
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderLeftColor = 'rgba(175, 96, 37, 0.4)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderLeftColor = 'transparent';
        }
      }}
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
        {run.ascendancy || run.class}
        {run.category && run.category !== 'any%' && (
          <span className="ml-1.5 text-xs text-[--color-poe-gold]/80">{run.category}</span>
        )}
      </div>
      <div className="text-xs text-[--color-text-muted] mt-1 flex items-center gap-2">
        <span>{run.totalTimeMs ? formatTime(run.totalTimeMs) : 'In Progress'}</span>
        {run.league && <span className="opacity-70">{run.league}</span>}
        {run.isPersonalBest && (
          <span className="text-[--color-timer-gold]">PB</span>
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
  const { accountName } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<TabType>('equipment');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [exportAllStatus, setExportAllStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [shareAllStatus, setShareAllStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [shareAllUrl, setShareAllUrl] = useState<string | null>(null);

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

  const handleExportAllToPob = async () => {
    if (snapshots.length === 0) return;
    setExportAllStatus('loading');
    try {
      await exportAllToPob(snapshots, run, splits, accountName);
      setExportAllStatus('success');
      setTimeout(() => setExportAllStatus('idle'), 2000);
    } catch (error) {
      console.error('Export all failed:', error);
      setExportAllStatus('error');
      setTimeout(() => setExportAllStatus('idle'), 3000);
    }
  };

  const handleShareAllOnPobbIn = async () => {
    if (snapshots.length === 0) return;
    setShareAllStatus('loading');
    try {
      const url = await shareAllOnPobbIn(snapshots, run, splits, accountName);
      setShareAllUrl(url);
      setShareAllStatus('success');
      window.open(url, '_blank');
    } catch (error) {
      console.error('Share all failed:', error);
      setShareAllStatus('error');
      setTimeout(() => setShareAllStatus('idle'), 3000);
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
          {run.ascendancy || run.class || 'Unknown'}
          {run.category && run.category !== 'any%' && (
            <span className="ml-1.5 text-[--color-poe-gold]/80">{run.category}</span>
          )}
          {run.league && <span className="ml-1.5">- {run.league}</span>}
        </p>
      </div>

      {/* Timeline scrubber */}
      <div className="px-6 py-4 border-b border-[--color-border]">
        <div className="text-sm text-[--color-text-muted] mb-2">
          Snapshot Timeline
          {isLoading && <span className="ml-2"><LoadingSpinner size="sm" /></span>}
        </div>
        <div className="relative h-8">
          {/* Line segments connecting markers */}
          {timelineMarkers.length > 0 && (() => {
            const firstPos = (timelineMarkers[0].split.splitTimeMs / maxTime) * 100;
            const lastPos = (timelineMarkers[timelineMarkers.length - 1].split.splitTimeMs / maxTime) * 100;
            return (
              <>
                {/* Lead-in line from left edge to first dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{
                    left: 0,
                    width: `${firstPos}%`,
                    height: '2px',
                    opacity: 0.3,
                    background: 'var(--color-text-muted)',
                    maskImage: 'linear-gradient(90deg, transparent 0px, black 12px, black calc(100% - 9px), transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(90deg, transparent 0px, black 12px, black calc(100% - 9px), transparent 100%)',
                  }}
                />
                {/* Segments between consecutive dots */}
                {timelineMarkers.map((marker, i) => {
                  if (i === 0) return null;
                  const prevPos = (timelineMarkers[i - 1].split.splitTimeMs / maxTime) * 100;
                  const currPos = (marker.split.splitTimeMs / maxTime) * 100;
                  return (
                    <div
                      key={`line-${marker.split.id}`}
                      className="absolute top-1/2 -translate-y-1/2"
                      style={{
                        left: `${prevPos}%`,
                        width: `${currPos - prevPos}%`,
                        height: '2px',
                        opacity: 0.3,
                        background: 'var(--color-text-muted)',
                        maskImage: 'linear-gradient(90deg, transparent 0px, black 9px, black calc(100% - 9px), transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(90deg, transparent 0px, black 9px, black calc(100% - 9px), transparent 100%)',
                      }}
                    />
                  );
                })}
                {/* Trail line from last dot to right edge */}
                <div
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{
                    left: `${lastPos}%`,
                    width: `${100 - lastPos}%`,
                    height: '2px',
                    opacity: 0.3,
                    background: 'var(--color-text-muted)',
                    maskImage: 'linear-gradient(90deg, transparent 0px, black 9px, black calc(100% - 12px), transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(90deg, transparent 0px, black 9px, black calc(100% - 12px), transparent 100%)',
                  }}
                />
              </>
            );
          })()}

          {/* Timeline markers */}
          {timelineMarkers.map((marker) => {
            const position = (marker.split.splitTimeMs / maxTime) * 100;
            const isSelected = marker.snapshot?.id === selectedSnapshot?.id;

            // Determine dot style
            let dotClass: string;
            if (marker.isPending) {
              dotClass = 'bg-yellow-500 border-yellow-400 animate-pulse';
            } else if (marker.failError) {
              dotClass = 'bg-red-500 border-red-400 cursor-pointer';
            } else if (isSelected) {
              dotClass = 'scale-150 shadow-[0_0_12px_rgba(175,96,37,0.6)]';
            } else if (marker.snapshot) {
              dotClass = 'bg-[--color-poe-gold]/60 border-[--color-poe-gold-light]/60 hover:scale-110 hover:bg-[--color-poe-gold] hover:border-[--color-poe-gold-light]';
            } else {
              dotClass = 'bg-[--color-surface] border-[--color-border] hover:border-[--color-text-muted]';
            }

            return (
              <button
                key={marker.split.id}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all ${dotClass}`}
                style={{
                  left: `${position}%`,
                  ...(isSelected ? { backgroundColor: '#af6025', borderColor: '#af6025' } : {}),
                }}
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
          <span>{selectedSnapshot ? (() => {
            const matchingSplit = splits.find(s => s.id === selectedSnapshot.splitId);
            const zoneName = matchingSplit?.breakpointName;
            return `${formatTime(selectedSnapshot.elapsedTimeMs)} - Level ${selectedSnapshot.characterLevel}${zoneName ? ` - ${zoneName}` : ''}`;
          })() : ''}</span>
          <span>{formatTime(maxTime)}</span>
        </div>
      </div>

      {/* Content area */}
      {snapshots.length === 0 && !isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon={Camera} title="No snapshots yet" description="Snapshots are automatically captured at act transitions and boss kills." />
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
              <div className="grid grid-cols-[auto_1fr] gap-6">
                {/* Equipment grid */}
                <div className="shrink-0">
                  <EquipmentGrid items={equippedItems} />
                </div>
                {/* Skills panel */}
                <div className="min-w-0">
                  <div className="section-header rounded-t-lg px-3 py-2 mb-3">
                    <span className="text-sm font-medium text-[--color-text]">Socketed Gems</span>
                  </div>
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

          {/* Export bar */}
          <div className="px-6 py-3 border-t border-[--color-border] flex items-center gap-2 flex-wrap">
            {snapshots.length > 1 ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExportAllToPob}
                  disabled={exportAllStatus === 'loading'}
                  title="Export all snapshots as separate item/skill/tree sets"
                >
                  {exportAllStatus === 'loading' ? 'Copying...' : exportAllStatus === 'success' ? 'Copied!' : `Export All to PoB (${snapshots.length})`}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleShareAllOnPobbIn}
                  disabled={shareAllStatus === 'loading'}
                  title="Share all snapshots as one build with multiple sets"
                >
                  {shareAllStatus === 'loading' ? 'Uploading...' : shareAllStatus === 'success' ? 'Shared!' : 'Share All on pobb.in'}
                </Button>
                <span className="w-px h-5 bg-[--color-border] mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportToPob}
                  disabled={exportStatus === 'loading'}
                  title="Export only the selected snapshot"
                >
                  {exportStatus === 'loading' ? 'Copying...' : exportStatus === 'success' ? 'Copied!' : 'This Snapshot'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShareOnPobbIn}
                  disabled={shareStatus === 'loading'}
                  title="Share only the selected snapshot"
                >
                  {shareStatus === 'loading' ? 'Uploading...' : shareStatus === 'success' ? 'Shared!' : 'Share This'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExportToPob}
                  disabled={exportStatus === 'loading'}
                >
                  {exportStatus === 'loading' ? 'Copying...' : exportStatus === 'success' ? 'Copied!' : 'Export to PoB'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleShareOnPobbIn}
                  disabled={shareStatus === 'loading'}
                >
                  {shareStatus === 'loading' ? 'Uploading...' : shareStatus === 'success' ? 'Shared!' : 'Share on pobb.in'}
                </Button>
              </>
            )}
            <span className="w-px h-5 bg-[--color-border] mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportRunToJson(run.id, run)}
              title="Export full run data as JSON"
            >
              Export JSON
            </Button>
            {(shareStatus === 'success' && shareUrl) && (
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[--color-poe-gold] hover:underline truncate max-w-xs ml-auto">
                {shareUrl}
              </a>
            )}
            {(shareAllStatus === 'success' && shareAllUrl) && (
              <a href={shareAllUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[--color-poe-gold] hover:underline truncate max-w-xs ml-auto">
                {shareAllUrl}
              </a>
            )}
            {(exportStatus === 'error' || shareStatus === 'error' || exportAllStatus === 'error' || shareAllStatus === 'error') && (
              <span className="text-xs text-red-400 ml-auto">Export failed</span>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState icon={MousePointerClick} title="Select a snapshot" description="Click a marker on the timeline above." />
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
