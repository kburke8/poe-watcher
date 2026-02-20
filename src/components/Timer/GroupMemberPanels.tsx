import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Users, Loader2, ArrowLeft } from 'lucide-react';
import { useGroupStore } from '../../stores/groupStore';
import { useRunStore } from '../../stores/runStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { MemberCharacterInfo } from '../../types';

interface PollResult {
  memberId: number;
  characterClass: string;
  characterLevel: number;
  characterLeague: string;
}

interface GroupMemberPanelsProps {
  onSelectMember?: (target: 'player' | number, displayName: string) => void;
  onBack?: () => void;
}

export function GroupMemberPanels({ onSelectMember, onBack }: GroupMemberPanelsProps) {
  const members = useGroupStore((s) => s.members);
  const memberCharacterInfo = useGroupStore((s) => s.memberCharacterInfo);
  const detectionStatus = useGroupStore((s) => s.detectionStatus);
  const isDetecting = useGroupStore((s) => s.isDetecting);
  const loadMembers = useGroupStore((s) => s.loadMembers);

  const currentRun = useRunStore((s) => s.currentRun);
  const currentLevel = useRunStore((s) => s.currentLevel);
  const isRunning = useRunStore((s) => s.timer.isRunning);
  const accountName = useSettingsStore((s) => s.accountName);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Poll group member levels every 30s while timer is running
  useEffect(() => {
    if (!isRunning) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const results = await invoke<PollResult[]>('poll_group_member_info');
        const store = useGroupStore.getState();
        const updated: Record<number, MemberCharacterInfo> = { ...store.memberCharacterInfo };
        for (const r of results) {
          updated[r.memberId] = {
            characterClass: r.characterClass,
            characterLevel: r.characterLevel,
            characterLeague: r.characterLeague,
            characterExperience: 0,
          };
        }
        useGroupStore.setState({ memberCharacterInfo: updated });
      } catch {
        // Silently ignore poll failures
      }
    };

    // Initial poll immediately, then every 30s
    poll();
    pollRef.current = setInterval(poll, 30_000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isRunning]);

  const activeMembers = members.filter((m) => m.isActive);
  const totalParty = activeMembers.length + 1; // +1 for player
  const cols = Math.min(totalParty, 6);

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 rounded-lg text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-elevated] transition-colors"
            title="Back to timer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <Users className="w-4 h-4 text-[--color-text-muted]" />
        <span className="text-xs font-medium text-[--color-text-muted] uppercase tracking-wider">
          Party ({totalParty})
        </span>
        {isDetecting && (
          <Loader2 className="w-3 h-3 text-[--color-poe-gold] animate-spin" />
        )}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {/* Player card - always first */}
        <button
          onClick={() => onSelectMember?.('player', accountName || currentRun?.characterName || 'You')}
          className="card-inset rounded-lg p-3 flex flex-col items-center text-center aspect-square justify-center border border-[--color-poe-gold]/20 cursor-pointer hover:bg-[--color-surface-elevated] transition-colors"
        >
          <span className="text-xs font-medium text-[--color-poe-gold] truncate w-full">
            {accountName || 'You'}
          </span>
          <span className="text-[11px] text-[--color-text-muted] truncate w-full mt-0.5">
            {currentRun?.characterName || currentRun?.character || 'Unknown'}
          </span>
          <div className="mt-2 flex flex-col items-center gap-0.5">
            <span className="text-[11px] text-[--color-poe-gold]">
              {currentRun?.class || 'Unknown'}
            </span>
            <span className="text-lg font-bold text-[--color-text] leading-none">
              {currentLevel}
            </span>
          </div>
        </button>

        {/* Group member cards */}
        {activeMembers.map((member) => {
          const info = memberCharacterInfo[member.id];
          const status = detectionStatus[member.id];

          return (
            <button
              key={member.id}
              onClick={() => onSelectMember?.(member.id, member.displayName || member.accountName)}
              className="card-inset rounded-lg p-3 flex flex-col items-center text-center aspect-square justify-center cursor-pointer hover:bg-[--color-surface-elevated] transition-colors"
            >
              <span className="text-xs font-medium text-[--color-text] truncate w-full">
                {member.displayName || member.accountName}
              </span>
              {member.characterName ? (
                <span className="text-[11px] text-[--color-text-muted] truncate w-full mt-0.5">
                  {member.characterName}
                </span>
              ) : (
                <span className="text-[11px] text-[--color-text-muted] italic mt-0.5">
                  {status === 'detecting' ? 'Detecting...' : 'Waiting...'}
                </span>
              )}
              {info ? (
                <div className="mt-2 flex flex-col items-center gap-0.5">
                  <span className="text-[11px] text-[--color-poe-gold]">
                    {info.characterClass}
                  </span>
                  <span className="text-lg font-bold text-[--color-text] leading-none">
                    {info.characterLevel}
                  </span>
                </div>
              ) : (
                <div className="mt-2">
                  {status === 'detecting' ? (
                    <Loader2 className="w-4 h-4 text-[--color-poe-gold] animate-spin" />
                  ) : status === 'failed' ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                      Error
                    </span>
                  ) : (
                    <span className="text-xs text-[--color-text-muted]">--</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
