import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Clock, Users, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { useGroupStore } from '../../stores/groupStore';
import { Button } from '../Shared/Button';
import { EquipmentGrid } from '../Snapshot/EquipmentGrid';
import type { Run, Split, PoeItem } from '../../types';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function GroupRunHistory() {
  const { groupRuns, loadGroupRuns, groupSnapshots, loadGroupSnapshots, selectedMemberId, selectMember } = useGroupStore();
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [splits, setSplits] = useState<Split[]>([]);
  const [selectedSplitId, setSelectedSplitId] = useState<number | null>(null);

  useEffect(() => {
    loadGroupRuns();
  }, [loadGroupRuns]);

  const handleSelectRun = async (run: Run) => {
    setSelectedRun(run);
    setSelectedSplitId(null);
    selectMember(null);

    try {
      const runSplits = await invoke<Split[]>('get_splits', { runId: run.id });
      setSplits(runSplits);
      await loadGroupSnapshots(run.id);
    } catch (err) {
      console.error('Failed to load run data:', err);
    }
  };

  // Get snapshots for selected split and member
  const splitSnapshots = selectedSplitId
    ? groupSnapshots.filter((s) => s.splitId === selectedSplitId)
    : [];

  const selectedSnapshot = selectedMemberId
    ? splitSnapshots.find((s) => s.groupMemberId === selectedMemberId)
    : splitSnapshots[0] || null;

  // Parse items from snapshot
  const parsedItems = selectedSnapshot
    ? (() => {
        try {
          const items: PoeItem[] = JSON.parse(selectedSnapshot.itemsJson);
          const map = new Map<string, PoeItem>();
          for (const item of items) {
            if (item.inventoryId) {
              map.set(item.inventoryId, item);
            }
          }
          return map;
        } catch {
          return new Map<string, PoeItem>();
        }
      })()
    : new Map<string, PoeItem>();

  if (!selectedRun) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-[--color-text] mb-3">Group Run History</h3>
        {groupRuns.length === 0 ? (
          <p className="text-sm text-[--color-text-muted]">No group runs yet. Start a run with Group Mode enabled.</p>
        ) : (
          <div className="space-y-2">
            {groupRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => handleSelectRun(run)}
                className="w-full card-inset rounded-lg p-3 text-left hover:bg-[--color-surface-elevated] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-[--color-text]">{run.category}</div>
                    <div className="text-xs text-[--color-text-muted]">
                      {new Date(run.startedAt).toLocaleDateString()} - {run.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {run.totalTimeMs && (
                      <span className="text-sm text-[--color-poe-gold] font-mono">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatTime(run.totalTimeMs)}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[--color-text-muted]" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" variant="secondary" onClick={() => { setSelectedRun(null); setSplits([]); }}>
          Back
        </Button>
        <h3 className="text-sm font-semibold text-[--color-text]">
          {selectedRun.category} - {new Date(selectedRun.startedAt).toLocaleDateString()}
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Splits list */}
        <div>
          <h4 className="text-xs font-medium text-[--color-text-muted] mb-2 uppercase">Splits</h4>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {splits.map((split) => {
              const hasGroupSnaps = groupSnapshots.some((s) => s.splitId === split.id);
              return (
                <button
                  key={split.id}
                  onClick={() => {
                    setSelectedSplitId(split.id);
                    selectMember(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedSplitId === split.id
                      ? 'bg-[--color-poe-gold]/20 text-[--color-poe-gold]'
                      : 'text-[--color-text] hover:bg-[--color-surface-elevated]'
                  }`}
                >
                  <div className="flex justify-between">
                    <span>{split.breakpointName}</span>
                    <span className="font-mono text-xs">{formatTime(split.splitTimeMs)}</span>
                  </div>
                  {hasGroupSnaps && (
                    <div className="flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3 text-[--color-text-muted]" />
                      <span className="text-xs text-[--color-text-muted]">
                        {groupSnapshots.filter((s) => s.splitId === split.id).length} member snapshots
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Member snapshots for selected split */}
        <div>
          {selectedSplitId ? (
            <>
              <h4 className="text-xs font-medium text-[--color-text-muted] mb-2 uppercase">
                Member Snapshots
              </h4>

              {/* Member tabs */}
              {splitSnapshots.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex gap-1 flex-wrap">
                    {splitSnapshots.map((snap) => (
                      <button
                        key={snap.id}
                        onClick={() => selectMember(snap.groupMemberId)}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          (selectedMemberId || splitSnapshots[0]?.groupMemberId) === snap.groupMemberId
                            ? 'bg-[--color-poe-gold]/20 text-[--color-poe-gold]'
                            : 'text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-elevated]'
                        }`}
                      >
                        {snap.characterName || snap.accountName}
                        <span className="ml-1 opacity-60">Lv.{snap.characterLevel}</span>
                      </button>
                    ))}
                  </div>

                  {/* Selected member's snapshot content */}
                  {selectedSnapshot && (
                    <div className="card-inset rounded-lg p-3">
                      <div className="text-sm text-[--color-text] mb-2">
                        <span className="font-medium">{selectedSnapshot.characterName}</span>
                        <span className="text-[--color-text-muted] ml-2">({selectedSnapshot.accountName})</span>
                        <span className="text-[--color-poe-gold] ml-2">Lv.{selectedSnapshot.characterLevel}</span>
                      </div>
                      <EquipmentGrid items={parsedItems} />

                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              const { exportGroupMemberToPob } = await import('../../utils/pobExport');
                              await exportGroupMemberToPob(selectedSnapshot);
                            } catch (err) {
                              console.error('PoB export failed:', err);
                            }
                          }}
                        >
                          <Copy className="w-3 h-3 mr-1" /> PoB
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              const { shareGroupMemberOnPobbIn } = await import('../../utils/pobExport');
                              const url = await shareGroupMemberOnPobbIn(selectedSnapshot);
                              if (url) window.open(url, '_blank');
                            } catch (err) {
                              console.error('pobb.in share failed:', err);
                            }
                          }}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> pobb.in
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[--color-text-muted]">No group snapshots for this split.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-[--color-text-muted]">Select a split to view member snapshots.</p>
          )}
        </div>
      </div>
    </div>
  );
}
