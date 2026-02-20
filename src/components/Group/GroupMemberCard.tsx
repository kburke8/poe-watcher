import { useState } from 'react';
import { Trash2, Search, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '../Shared/Button';
import { Toggle } from '../Shared/Toggle';
import { useGroupStore } from '../../stores/groupStore';
import type { GroupMember, PoeCharacter } from '../../types';

interface GroupMemberCardProps {
  member: GroupMember;
}

export function GroupMemberCard({ member }: GroupMemberCardProps) {
  const { updateMember, removeMember, setMemberActive } = useGroupStore();
  const detectionStatus = useGroupStore((s) => s.detectionStatus[member.id]);
  const [isEditing, setIsEditing] = useState(false);
  const [editCharName, setEditCharName] = useState(member.characterName || '');
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedChars, setResolvedChars] = useState<PoeCharacter[] | null>(null);

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      const characters = await invoke<PoeCharacter[]>('resolve_group_member_characters', {
        accountName: member.accountName,
      });
      setResolvedChars(characters);
    } catch (err) {
      console.error('Failed to resolve characters:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const handleSelectCharacter = async (charName: string) => {
    await updateMember(member.id, charName, member.displayName);
    setResolvedChars(null);
  };

  const handleSaveManual = async () => {
    await updateMember(member.id, editCharName || null, member.displayName);
    setIsEditing(false);
  };

  const statusBadge = () => {
    switch (detectionStatus) {
      case 'detecting':
        return <span className="text-xs text-yellow-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Detecting...</span>;
      case 'resolved':
        return <span className="text-xs text-green-400">Auto-detected</span>;
      case 'failed':
        return <span className="text-xs text-red-400">Detection failed</span>;
      default:
        return null;
    }
  };

  return (
    <div className={`card-inset rounded-lg p-3 ${!member.isActive ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[--color-text] truncate">
              {member.accountName}
            </span>
            {statusBadge()}
          </div>

          {member.characterName ? (
            <div className="text-xs text-[--color-poe-gold] mt-1">
              {member.characterName}
            </div>
          ) : (
            <div className="text-xs text-[--color-text-muted] mt-1">
              No character detected
            </div>
          )}

          {isEditing && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={editCharName}
                onChange={(e) => setEditCharName(e.target.value)}
                placeholder="Character name"
                className="flex-1 px-2 py-1 rounded bg-[--color-surface] border border-[--color-border] text-[--color-text] text-xs focus:outline-none focus:border-[--color-poe-gold]/50"
              />
              <Button size="sm" variant="primary" onClick={handleSaveManual}>
                Save
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </div>
          )}

          {resolvedChars && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {resolvedChars.length === 0 ? (
                <p className="text-xs text-[--color-text-muted]">No characters found</p>
              ) : (
                resolvedChars.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => handleSelectCharacter(c.name)}
                    className="w-full text-left px-2 py-1 rounded text-xs hover:bg-[--color-surface-elevated] text-[--color-text]"
                  >
                    {c.name} - Lv.{c.level} {c.class} ({c.league})
                  </button>
                ))
              )}
              <Button size="sm" variant="secondary" onClick={() => setResolvedChars(null)} className="mt-1">
                Close
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isEditing && !resolvedChars && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-[--color-text-muted] hover:text-[--color-text] rounded"
                title="Set character name manually"
              >
                <span className="text-xs">Edit</span>
              </button>
              <button
                onClick={handleResolve}
                disabled={isResolving}
                className="p-1 text-[--color-text-muted] hover:text-[--color-poe-gold] rounded"
                title="Look up characters"
              >
                {isResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </>
          )}
          <Toggle
            checked={member.isActive}
            onChange={(v) => setMemberActive(member.id, v)}
          />
          <button
            onClick={() => removeMember(member.id)}
            className="p-1 text-[--color-text-muted] hover:text-red-400 rounded"
            title="Remove member"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
