import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Snapshot, PoeItem } from '../types';

interface SnapshotState {
  // Loaded snapshots for selected run
  snapshots: Snapshot[];
  // Currently selected snapshot
  selectedSnapshotId: number | null;
  // Split IDs currently being captured
  pendingCaptures: Set<number>;
  // Split IDs that failed to capture
  failedCaptures: Map<number, string>;
  // Loading state
  isLoading: boolean;

  // Actions
  loadSnapshots: (runId: number) => Promise<void>;
  selectSnapshot: (id: number | null) => void;
  addPendingCapture: (splitId: number) => void;
  removePendingCapture: (splitId: number) => void;
  addFailedCapture: (splitId: number, error: string) => void;
  removeFailedCapture: (splitId: number) => void;
  addSnapshot: (snapshot: Snapshot) => void;
  clearSnapshots: () => void;

  // Retry capture
  retryCapture: (
    runId: number,
    splitId: number,
    elapsedTimeMs: number,
    accountName: string,
    characterName: string
  ) => Promise<void>;
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  snapshots: [],
  selectedSnapshotId: null,
  pendingCaptures: new Set(),
  failedCaptures: new Map(),
  isLoading: false,

  loadSnapshots: async (runId: number) => {
    set({ isLoading: true });
    try {
      const snapshots = await invoke<Snapshot[]>('get_snapshots', { runId });
      set({
        snapshots,
        selectedSnapshotId: snapshots.length > 0 ? snapshots[0].id : null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load snapshots:', error);
      set({ isLoading: false });
    }
  },

  selectSnapshot: (id: number | null) => {
    set({ selectedSnapshotId: id });
  },

  addPendingCapture: (splitId: number) => {
    set((state) => {
      const newPending = new Set(state.pendingCaptures);
      newPending.add(splitId);
      // Remove from failed if it was there (retry case)
      const newFailed = new Map(state.failedCaptures);
      newFailed.delete(splitId);
      return { pendingCaptures: newPending, failedCaptures: newFailed };
    });
  },

  removePendingCapture: (splitId: number) => {
    set((state) => {
      const newPending = new Set(state.pendingCaptures);
      newPending.delete(splitId);
      return { pendingCaptures: newPending };
    });
  },

  addFailedCapture: (splitId: number, error: string) => {
    set((state) => {
      const newPending = new Set(state.pendingCaptures);
      newPending.delete(splitId);
      const newFailed = new Map(state.failedCaptures);
      newFailed.set(splitId, error);
      return { pendingCaptures: newPending, failedCaptures: newFailed };
    });
  },

  removeFailedCapture: (splitId: number) => {
    set((state) => {
      const newFailed = new Map(state.failedCaptures);
      newFailed.delete(splitId);
      return { failedCaptures: newFailed };
    });
  },

  addSnapshot: (snapshot: Snapshot) => {
    set((state) => {
      // Remove from pending
      const newPending = new Set(state.pendingCaptures);
      newPending.delete(snapshot.splitId);
      // Add snapshot and sort by elapsed time
      const newSnapshots = [...state.snapshots, snapshot].sort(
        (a, b) => a.elapsedTimeMs - b.elapsedTimeMs
      );
      return {
        snapshots: newSnapshots,
        pendingCaptures: newPending,
        // Auto-select the new snapshot
        selectedSnapshotId: snapshot.id,
      };
    });
  },

  clearSnapshots: () => {
    set({
      snapshots: [],
      selectedSnapshotId: null,
      pendingCaptures: new Set(),
      failedCaptures: new Map(),
    });
  },

  retryCapture: async (
    runId: number,
    splitId: number,
    elapsedTimeMs: number,
    accountName: string,
    characterName: string
  ) => {
    get().addPendingCapture(splitId);
    try {
      await invoke('capture_snapshot', {
        request: {
          run_id: runId,
          split_id: splitId,
          elapsed_time_ms: elapsedTimeMs,
          account_name: accountName,
          character_name: characterName,
        },
      });
    } catch (error) {
      console.error('Failed to retry snapshot capture:', error);
      get().addFailedCapture(splitId, String(error));
    }
  },
}));

// Helper functions for parsing snapshot data

export function parseItems(itemsJson: string): PoeItem[] {
  try {
    return JSON.parse(itemsJson) as PoeItem[];
  } catch {
    return [];
  }
}

export function parsePassives(passiveTreeJson: string): {
  hashes: number[];
  hashesEx: number[];
  masteryEffects: Record<string, number>;  // nodeId -> effectId
} {
  try {
    const data = JSON.parse(passiveTreeJson);
    return {
      hashes: data.hashes || [],
      hashesEx: data.hashes_ex || data.hashesEx || [],
      // Handle both snake_case and camelCase field names from API
      masteryEffects: data.mastery_effects || data.masteryEffects || {},
    };
  } catch {
    return { hashes: [], hashesEx: [], masteryEffects: {} };
  }
}

export function getEquippedItems(items: PoeItem[]): Map<string, PoeItem> {
  const equipped = new Map<string, PoeItem>();
  for (const item of items) {
    // inventoryId indicates equipped slot
    if (item.inventoryId && !item.inventoryId.startsWith('Stash')) {
      // Handle flasks specially - they all have inventoryId "Flask" but different x positions
      if (item.inventoryId === 'Flask' && item.x !== undefined) {
        equipped.set(`Flask${item.x + 1}`, item);
      } else {
        equipped.set(item.inventoryId, item);
      }
    }
  }
  return equipped;
}

export function getSocketedGems(items: PoeItem[]): PoeItem[] {
  const gems: PoeItem[] = [];
  for (const item of items) {
    if (item.socketedItems && item.socketedItems.length > 0) {
      gems.push(...item.socketedItems);
    }
  }
  return gems;
}

// Get frame type color class
export function getFrameTypeColor(frameType: number): string {
  switch (frameType) {
    case 0: return 'text-white'; // Normal
    case 1: return 'text-blue-400'; // Magic
    case 2: return 'text-yellow-400'; // Rare
    case 3: return 'text-orange-400'; // Unique
    case 4: return 'text-green-400'; // Gem
    case 5: return 'text-cyan-400'; // Currency
    case 6: return 'text-yellow-200'; // Divination
    case 7: return 'text-purple-400'; // Quest
    case 8: return 'text-orange-300'; // Prophecy
    case 9: return 'text-pink-400'; // Foil/Relic
    default: return 'text-white';
  }
}
