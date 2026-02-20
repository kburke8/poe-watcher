import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, Camera } from 'lucide-react';
import { EquipmentGrid } from '../Snapshot/EquipmentGrid';
import { SkillsDisplay } from '../Snapshot/SkillsDisplay';
import { PassiveTree } from '../Snapshot/PassiveTree';
import { PassivesSummary } from '../Snapshot/PassivesSummary';
import { parseItems, parsePassives, getEquippedItems } from '../../stores/snapshotStore';
import { useRunStore } from '../../stores/runStore';
import type { Snapshot, GroupSnapshot, Split } from '../../types';

type TabType = 'equipment' | 'passives';

interface InlineSnapshotViewProps {
  /** 'player' for the local player, or a group member ID */
  target: 'player' | number;
  /** Display name for the header */
  displayName: string;
  onBack: () => void;
}

export function InlineSnapshotView({ target, displayName, onBack }: InlineSnapshotViewProps) {
  const [snapshot, setSnapshot] = useState<Snapshot | GroupSnapshot | null>(null);
  const [splitName, setSplitName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('equipment');
  const currentRun = useRunStore((s) => s.currentRun);

  useEffect(() => {
    if (!currentRun?.id) {
      setSnapshot(null);
      setSplitName(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        // Fetch splits to resolve zone names
        const splits = await invoke<Split[]>('get_splits', { runId: currentRun.id });
        const splitMap = new Map(splits.map((s) => [s.id, s.breakpointName]));

        if (target === 'player') {
          const snapshots = await invoke<Snapshot[]>('get_snapshots', { runId: currentRun.id });
          const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
          setSnapshot(latest);
          setSplitName(latest ? splitMap.get(latest.splitId) ?? null : null);
        } else {
          const snapshots = await invoke<GroupSnapshot[]>('get_group_snapshots', { runId: currentRun.id });
          const memberSnapshots = snapshots.filter((s) => s.groupMemberId === target);
          const latest = memberSnapshots.length > 0 ? memberSnapshots[memberSnapshots.length - 1] : null;
          setSnapshot(latest);
          setSplitName(latest ? splitMap.get(latest.splitId) ?? null : null);
        }
      } catch (error) {
        console.error('[InlineSnapshotView] Failed to load snapshot:', error);
        setSnapshot(null);
        setSplitName(null);
      }
      setLoading(false);
    };

    load();
  }, [target, currentRun?.id]);

  const items = useMemo(() => {
    if (!snapshot?.itemsJson) return [];
    return parseItems(snapshot.itemsJson);
  }, [snapshot]);

  const equippedItems = useMemo(() => getEquippedItems(items), [items]);

  const passives = useMemo(() => {
    if (!snapshot) return { hashes: [], hashesEx: [], masteryEffects: {} };
    return parsePassives(snapshot.passiveTreeJson);
  }, [snapshot]);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-elevated] transition-colors"
          title="Back to timer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[--color-text]">{displayName}</span>
          {snapshot && (
            <span className="text-xs text-[--color-text-muted] ml-2">
              Level {snapshot.characterLevel}
              {splitName && (
                <> &middot; Snapshot @ <span className="text-[--color-poe-gold]">{splitName}</span></>
              )}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[--color-text-muted] text-sm">
          Loading snapshot...
        </div>
      ) : !snapshot ? (
        <div className="flex-1 flex flex-col items-center justify-center text-[--color-text-muted]">
          <Camera className="w-8 h-8 mb-2 opacity-40" />
          <span className="text-sm">No snapshot taken yet</span>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-[--color-border] mb-3">
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

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'equipment' && (
              <div className="grid grid-cols-[auto_1fr] gap-4">
                <div className="shrink-0">
                  <EquipmentGrid items={equippedItems} />
                </div>
                <div className="min-w-0">
                  <div className="section-header rounded-t-lg px-3 py-1.5 mb-2">
                    <span className="text-xs font-medium text-[--color-text]">Socketed Gems</span>
                  </div>
                  <SkillsDisplay items={items} compact columns={2} />
                </div>
              </div>
            )}
            {activeTab === 'passives' && (
              <div className="space-y-3">
                <PassiveTree
                  allocatedNodes={passives.hashes}
                  masterySelections={passives.masteryEffects}
                  characterClass={currentRun?.class}
                  width={Math.min(700, window.innerWidth - 500)}
                  height={400}
                />
                <PassivesSummary
                  hashes={passives.hashes}
                  hashesEx={passives.hashesEx}
                  characterLevel={snapshot.characterLevel}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
