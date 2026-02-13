import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Run, Split, SplitTime, TimerState, RunFilters, RunStats, SplitStat, PersonalBest, GoldSplit } from '../types';
import { useSettingsStore } from './settingsStore';
import { getWizardCategory } from '../config/wizardRoutes';

interface RunState {
  // Current run
  currentRun: Run | null;
  splits: Split[];

  // Timer state
  timer: TimerState;

  // Run history
  runs: Run[];
  personalBests: Map<string, number>;
  goldSplits: Map<string, number>;

  // Filtering state
  filters: RunFilters;
  filteredRuns: Run[];
  runStats: RunStats | null;
  splitStats: SplitStat[];

  // Actions
  startRun: (run: Omit<Run, 'id' | 'isCompleted' | 'isPersonalBest' | 'endedAt' | 'totalTimeMs'>) => void;
  endRun: () => void;
  resetRun: () => void;
  addSplit: (split: Omit<Split, 'id' | 'runId'>) => void;

  // Timer actions
  startTimer: () => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  updateElapsed: (ms: number) => void;
  enterZone: (zoneName: string, isTown: boolean, isHideout?: boolean) => void;
  setRunId: (id: number) => void;

  // Data loading
  setRuns: (runs: Run[]) => void;
  setSplits: (splits: Split[]) => void;
  setPersonalBests: (pbs: Map<string, number>) => void;
  setGoldSplits: (golds: Map<string, number>) => void;
  loadPbAndGoldSplits: () => Promise<void>;

  // Filtering actions
  setFilters: (filters: Partial<RunFilters>) => void;
  clearFilters: () => void;
  loadFilteredRuns: () => Promise<void>;
  loadRunStats: () => Promise<void>;
  loadSplitStats: () => Promise<void>;
}

const initialTimerState: TimerState = {
  isRunning: false,
  startTime: null,
  elapsedMs: 0,
  currentSplit: 0,
  splits: [],
  // Town/Hideout time tracking
  townTimeMs: 0,
  hideoutTimeMs: 0,
  inTown: false,
  inHideout: false,
  townEnteredAt: null,
  hideoutEnteredAt: null,
  currentZone: null,
};

export const useRunStore = create<RunState>((set, get) => ({
  // Initial state
  currentRun: null,
  splits: [],
  timer: initialTimerState,
  runs: [],
  personalBests: new Map(),
  goldSplits: new Map(),

  // Filtering state
  filters: {},
  filteredRuns: [],
  runStats: null,
  splitStats: [],

  // Run actions
  startRun: (runData) => {
    const run: Run = {
      ...runData,
      id: Date.now(), // Temporary ID, will be replaced by DB
      isCompleted: false,
      isPersonalBest: false,
      endedAt: null,
      totalTimeMs: null,
    };
    set({
      currentRun: run,
      splits: [],
      timer: {
        ...initialTimerState,
        isRunning: true,
        startTime: Date.now(),
      }
    });
  },

  endRun: () => {
    const { currentRun, timer } = get();
    if (!currentRun) return;

    const endedRun: Run = {
      ...currentRun,
      isCompleted: true,
      endedAt: new Date().toISOString(),
      totalTimeMs: timer.elapsedMs,
    };

    set((state) => ({
      currentRun: endedRun,
      runs: [...state.runs, endedRun],
      timer: { ...state.timer, isRunning: false },
    }));
  },

  resetRun: () => {
    set({
      currentRun: null,
      splits: [],
      timer: initialTimerState,
    });
  },

  addSplit: (splitData) => {
    const { currentRun, goldSplits, personalBests } = get();
    if (!currentRun) return;

    const pbTime = personalBests.get(`${currentRun.category}-${splitData.breakpointName}`);
    const goldTime = goldSplits.get(`${currentRun.category}-${splitData.breakpointName}`);

    const deltaMs = pbTime ? splitData.splitTimeMs - pbTime : null;
    const isBestSegment = goldTime ? splitData.segmentTimeMs < goldTime : true;

    const split: Split = {
      ...splitData,
      id: Date.now(),
      runId: currentRun.id,
      deltaMs,
    };

    const splitTime: SplitTime = {
      name: split.breakpointName,
      splitTimeMs: split.splitTimeMs,
      segmentTimeMs: split.segmentTimeMs,
      deltaMs,
      isBestSegment,
    };

    set((state) => ({
      splits: [...state.splits, split],
      timer: {
        ...state.timer,
        currentSplit: state.timer.currentSplit + 1,
        splits: [...state.timer.splits, splitTime],
      },
    }));
  },

  // Timer actions
  startTimer: () => {
    const { currentRun } = get();
    // Get test character name and wizard config from settings store
    const { testCharacterName, wizardConfig } = useSettingsStore.getState();

    // Create a default run if none exists
    if (!currentRun) {
      const category = wizardConfig ? getWizardCategory(wizardConfig) : 'any%';
      const run: Run = {
        id: Date.now(),
        category,
        class: 'Unknown',
        character: testCharacterName || 'Unknown',
        characterName: testCharacterName || 'Unknown',
        startedAt: new Date().toISOString(),
        isCompleted: false,
        isPersonalBest: false,
        endedAt: null,
        totalTimeMs: null,
      };
      set((state) => ({
        currentRun: run,
        splits: [],
        timer: {
          ...state.timer,
          isRunning: true,
          startTime: Date.now() - state.timer.elapsedMs,
          splits: [],
        },
      }));
    } else {
      set((state) => ({
        timer: {
          ...state.timer,
          isRunning: true,
          startTime: Date.now() - state.timer.elapsedMs,
        },
      }));
    }
  },

  stopTimer: () => {
    set((state) => ({
      timer: {
        ...state.timer,
        isRunning: false,
      },
    }));
  },

  pauseTimer: () => {
    set((state) => ({
      timer: {
        ...state.timer,
        isRunning: false,
      },
    }));
  },

  updateElapsed: (ms) => {
    set((state) => ({
      timer: {
        ...state.timer,
        elapsedMs: ms,
      },
    }));
  },

  enterZone: (zoneName: string, isTown: boolean, isHideout: boolean = false) => {
    const { timer } = get();
    const now = Date.now();

    // If we were in a town, accumulate the time spent there
    let newTownTimeMs = timer.townTimeMs;
    if (timer.inTown && timer.townEnteredAt !== null) {
      newTownTimeMs += now - timer.townEnteredAt;
    }

    // If we were in a hideout, accumulate the time spent there
    let newHideoutTimeMs = timer.hideoutTimeMs;
    if (timer.inHideout && timer.hideoutEnteredAt !== null) {
      newHideoutTimeMs += now - timer.hideoutEnteredAt;
    }

    set((state) => ({
      timer: {
        ...state.timer,
        currentZone: zoneName,
        inTown: isTown,
        inHideout: isHideout,
        townEnteredAt: isTown ? now : null,
        hideoutEnteredAt: isHideout ? now : null,
        townTimeMs: newTownTimeMs,
        hideoutTimeMs: newHideoutTimeMs,
      },
    }));
  },

  setRunId: (id) => {
    set((state) => ({
      currentRun: state.currentRun ? { ...state.currentRun, id } : null,
    }));
  },

  // Data loading
  setRuns: (runs) => set({ runs }),
  setSplits: (splits) => set({ splits }),
  setPersonalBests: (pbs) => set({ personalBests: pbs }),
  setGoldSplits: (golds) => set({ goldSplits: golds }),

  loadPbAndGoldSplits: async () => {
    try {
      const pbs = await invoke<PersonalBest[]>('get_personal_bests');
      if (import.meta.env.DEV) {
        console.log('[RunStore] loadPbAndGoldSplits: found', pbs.length, 'PBs:', pbs.map(pb => `${pb.category} (run ${pb.runId})`));
      }
      const pbSplitMap = new Map<string, number>();
      for (const pb of pbs) {
        try {
          const splits = await invoke<Split[]>('get_splits', { runId: pb.runId });
          if (import.meta.env.DEV) {
            console.log('[RunStore] PB run', pb.runId, 'splits:', splits.map(s => `${s.breakpointName}=${s.splitTimeMs}ms`));
          }
          for (const split of splits) {
            // Key by category-breakpointName only (no class) so PBs match
            // across runs regardless of character class detection timing
            const key = `${pb.category}-${split.breakpointName}`;
            const existing = pbSplitMap.get(key);
            // Keep the fastest split time if multiple PBs exist
            if (existing === undefined || split.splitTimeMs < existing) {
              pbSplitMap.set(key, split.splitTimeMs);
            }
          }
        } catch {
          // Skip PB runs whose splits can't be loaded
        }
      }
      if (import.meta.env.DEV) {
        console.log('[RunStore] PB map:', [...pbSplitMap.entries()]);
      }
      set({ personalBests: pbSplitMap });

      const golds = await invoke<GoldSplit[]>('get_gold_splits');
      const goldMap = new Map<string, number>();
      for (const gold of golds) {
        const key = `${gold.category}-${gold.breakpointName}`;
        goldMap.set(key, gold.bestSegmentMs);
      }
      set({ goldSplits: goldMap });
    } catch (error) {
      console.error('[RunStore] Failed to load PB/gold splits:', error);
    }
  },

  // Filtering actions
  setFilters: (newFilters) => set((state) => ({
    filters: { ...state.filters, ...newFilters },
  })),

  clearFilters: () => set({
    filters: {},
    filteredRuns: [],
    runStats: null,
    splitStats: [],
  }),

  loadFilteredRuns: async () => {
    try {
      const { filters } = get();
      const runs = await invoke<Run[]>('get_runs_filtered', { filters });
      set({ filteredRuns: runs });
    } catch (error) {
      console.error('[RunStore] Failed to load filtered runs:', error);
    }
  },

  loadRunStats: async () => {
    try {
      const { filters } = get();
      const stats = await invoke<RunStats>('get_run_stats', { filters });
      set({ runStats: stats });
    } catch (error) {
      console.error('[RunStore] Failed to load run stats:', error);
    }
  },

  loadSplitStats: async () => {
    try {
      const { filters } = get();
      const stats = await invoke<SplitStat[]>('get_split_stats', { filters });
      set({ splitStats: stats });
    } catch (error) {
      console.error('[RunStore] Failed to load split stats:', error);
    }
  },
}));
