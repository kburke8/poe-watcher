import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { GroupMember, NewGroupMember, GroupSnapshot, Run, MemberCharacterInfo } from '../types';

interface GroupState {
  members: GroupMember[];
  groupSnapshots: GroupSnapshot[];
  selectedMemberId: number | null;
  selectedGroupSnapshotId: number | null;
  detectionStatus: Record<number, 'pending' | 'detecting' | 'resolved' | 'failed'>;
  memberCharacterInfo: Record<number, MemberCharacterInfo>;
  isDetecting: boolean;
  groupRuns: Run[];

  // Member CRUD
  loadMembers: () => Promise<void>;
  addMember: (member: NewGroupMember) => Promise<number>;
  updateMember: (id: number, characterName: string | null, displayName: string | null) => Promise<void>;
  removeMember: (id: number) => Promise<void>;
  setMemberActive: (id: number, isActive: boolean) => Promise<void>;
  clearCharacterNames: () => Promise<void>;

  // Snapshots
  loadGroupSnapshots: (runId: number) => Promise<void>;
  selectMember: (memberId: number | null) => void;
  selectGroupSnapshot: (snapshotId: number | null) => void;
  clearGroupSnapshots: () => void;

  // Detection
  triggerDetection: (league: string) => Promise<void>;
  setDetectionStatus: (memberId: number, status: 'pending' | 'detecting' | 'resolved' | 'failed') => void;
  handleMemberDetected: (memberId: number, characterName: string, info?: MemberCharacterInfo) => void;
  setIsDetecting: (detecting: boolean) => void;

  // History
  loadGroupRuns: () => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  members: [],
  groupSnapshots: [],
  selectedMemberId: null,
  selectedGroupSnapshotId: null,
  detectionStatus: {},
  memberCharacterInfo: {},
  isDetecting: false,
  groupRuns: [],

  loadMembers: async () => {
    try {
      const members = await invoke<GroupMember[]>('get_group_members');
      set({ members });
    } catch (error) {
      console.error('[groupStore] Failed to load members:', error);
    }
  },

  addMember: async (member) => {
    const id = await invoke<number>('add_group_member', { member });
    await get().loadMembers();
    return id;
  },

  updateMember: async (id, characterName, displayName) => {
    await invoke('update_group_member', { id, characterName, displayName });
    await get().loadMembers();
  },

  removeMember: async (id) => {
    await invoke('remove_group_member', { id });
    await get().loadMembers();
  },

  setMemberActive: async (id, isActive) => {
    await invoke('set_group_member_active', { id, isActive });
    await get().loadMembers();
  },

  clearCharacterNames: async () => {
    await invoke('clear_group_character_names');
    await get().loadMembers();
    set({ detectionStatus: {}, memberCharacterInfo: {} });
  },

  loadGroupSnapshots: async (runId) => {
    try {
      const groupSnapshots = await invoke<GroupSnapshot[]>('get_group_snapshots', { runId });
      set({ groupSnapshots });
    } catch (error) {
      console.error('[groupStore] Failed to load group snapshots:', error);
    }
  },

  selectMember: (memberId) => set({ selectedMemberId: memberId, selectedGroupSnapshotId: null }),
  selectGroupSnapshot: (snapshotId) => set({ selectedGroupSnapshotId: snapshotId }),
  clearGroupSnapshots: () => set({ groupSnapshots: [], selectedMemberId: null, selectedGroupSnapshotId: null }),

  triggerDetection: async (league) => {
    set({ isDetecting: true });
    const members = get().members.filter(m => m.isActive && !m.characterName);
    const statusUpdates: Record<number, 'detecting'> = {};
    for (const member of members) {
      statusUpdates[member.id] = 'detecting';
    }
    set((state) => ({ detectionStatus: { ...state.detectionStatus, ...statusUpdates } }));

    try {
      await invoke('detect_group_characters', { league });
    } catch (error) {
      console.error('[groupStore] Detection failed:', error);
    }
    // Detection results come via events, isDetecting cleared when events arrive
  },

  setDetectionStatus: (memberId, status) => {
    set((state) => ({
      detectionStatus: { ...state.detectionStatus, [memberId]: status },
    }));
  },

  handleMemberDetected: (memberId, characterName, info) => {
    set((state) => ({
      members: state.members.map((m) =>
        m.id === memberId ? { ...m, characterName } : m
      ),
      detectionStatus: { ...state.detectionStatus, [memberId]: 'resolved' as const },
      memberCharacterInfo: info
        ? { ...state.memberCharacterInfo, [memberId]: info }
        : state.memberCharacterInfo,
    }));

    // Check if all active members are resolved
    const state = get();
    const activeMembers = state.members.filter(m => m.isActive);
    const allResolved = activeMembers.every(m =>
      m.characterName || state.detectionStatus[m.id] === 'resolved' || state.detectionStatus[m.id] === 'failed'
    );
    if (allResolved) {
      set({ isDetecting: false });
    }
  },

  setIsDetecting: (detecting) => set({ isDetecting: detecting }),

  loadGroupRuns: async () => {
    try {
      const allRuns = await invoke<Run[]>('get_runs');
      const groupRuns = allRuns.filter((r) => r.isGroupRun);
      set({ groupRuns });
    } catch (error) {
      console.error('[groupStore] Failed to load group runs:', error);
    }
  },
}));
