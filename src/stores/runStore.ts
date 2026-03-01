import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Run, Split, SplitTime, TimerState, RunFilters, RunStats, SplitStat, PersonalBest, GoldSplit } from '../types';
import { useSettingsStore } from './settingsStore';
import { getWizardCategory } from '../config/wizardRoutes';

interface RunState {
  // Current run
  currentRun: Run | null;
  currentLevel: number;
  splits: Split[];

  // Timer state
  timer: TimerState;

  // Run history
  runs: Run[];
  personalBests: Map<string, number>;
  goldSplits: Map<string, number>;

  // Comparison run splits (keyed by breakpointName -> splitTimeMs)
  comparisonSplits: Map<string, number>;

  // Filtering state
  filters: RunFilters;
  filteredRuns: Run[];
  runStats: RunStats | null;
  splitStats: SplitStat[];

  // Actions
  startRun: (run: Omit<Run, 'id' | 'isCompleted' | 'isPersonalBest' | 'status' | 'endedAt' | 'totalTimeMs'>) => void;
  endRun: () => void;
  abandonRun: () => void;
  resetRun: () => void;
  addSplit: (split: Omit<Split, 'id' | 'runId'>) => void;

  // Timer actions
  startTimer: () => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  updateElapsed: (ms: number) => void;
  enterZone: (zoneName: string, isTown: boolean, isHideout?: boolean) => void;
  startBossEncounter: (bossName: string) => void;
  incrementDeathCount: () => void;
  setRunId: (id: number) => void;
  setCurrentLevel: (level: number) => void;
  enterEndgame: (finalTimeMs: number) => void;
  setLatestSeed: (seed: number, areaLevel?: number) => void;
  startMappingSession: () => void;
  stopMappingSession: () => void;

  // Data loading
  setRuns: (runs: Run[]) => void;
  setSplits: (splits: Split[]) => void;
  setPersonalBests: (pbs: Map<string, number>) => void;
  setGoldSplits: (golds: Map<string, number>) => void;
  loadPbAndGoldSplits: () => Promise<void>;
  loadComparisonSplits: (runId: number) => Promise<void>;
  clearComparisonSplits: () => void;

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
  // Death tracking
  deathCount: 0,
  // Town visit & boss encounter tracking
  townVisits: [],
  activeBossEncounter: null,
  bossEncounters: [],
  // Endgame mode
  isInEndgame: false,
  act10FinalTimeMs: null,
  mapCount: 0,
  currentMapEnteredAt: null,
  currentMapElapsedMs: 0,
  currentMapZone: null,
  currentMapAreaLevel: null,
  currentMapSeed: null,
  latestSeed: null,
  latestAreaLevel: null,
  endgameTownTimeMs: 0,
  endgameDeathCount: 0,
  // Mapping session
  isMappingSession: false,
  completedMaps: [],
};

export const useRunStore = create<RunState>((set, get) => ({
  // Initial state
  currentRun: null,
  currentLevel: 1,
  splits: [],
  timer: initialTimerState,
  runs: [],
  personalBests: new Map(),
  goldSplits: new Map(),
  comparisonSplits: new Map(),

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
      status: 'in_progress',
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
      status: 'completed',
      endedAt: new Date().toISOString(),
      totalTimeMs: timer.elapsedMs,
    };

    set((state) => ({
      currentRun: endedRun,
      runs: [...state.runs, endedRun],
      timer: { ...state.timer, isRunning: false },
    }));
  },

  abandonRun: () => {
    const { currentRun, timer } = get();
    if (!currentRun) return;

    const totalTimeMs = timer.isRunning && timer.startTime
      ? Date.now() - timer.startTime
      : timer.elapsedMs;

    const abandonedRun: Run = {
      ...currentRun,
      status: 'abandoned',
      endedAt: new Date().toISOString(),
      totalTimeMs,
    };

    set((state) => ({
      currentRun: abandonedRun,
      runs: [...state.runs, abandonedRun],
      timer: { ...state.timer, isRunning: false },
    }));
  },

  resetRun: () => {
    set({
      currentRun: null,
      currentLevel: 1,
      splits: [],
      timer: initialTimerState,
    });
  },

  addSplit: (splitData) => {
    const { currentRun, goldSplits, personalBests, comparisonSplits } = get();
    if (!currentRun) return;

    // Use comparison splits if active, otherwise fall back to PB
    const compTime = comparisonSplits.get(splitData.breakpointName);
    const pbTime = personalBests.get(`${currentRun.category}-${currentRun.class}-${splitData.breakpointName}`);
    const referenceTime = compTime ?? pbTime;
    const goldTime = goldSplits.get(`${currentRun.category}-${currentRun.class}-${splitData.breakpointName}`);

    const deltaMs = referenceTime ? splitData.splitTimeMs - referenceTime : null;
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
    const { currentRun, timer } = get();

    // Mapping session: just resume the timer without creating a run
    if (timer.isMappingSession) {
      const now = Date.now();
      set((state) => ({
        timer: {
          ...state.timer,
          isRunning: true,
          startTime: now - state.timer.elapsedMs,
          townEnteredAt: state.timer.inTown ? now : state.timer.townEnteredAt,
          hideoutEnteredAt: state.timer.inHideout ? now : state.timer.hideoutEnteredAt,
        },
      }));
      return;
    }

    // Get test character name and wizard config from settings store
    const { testCharacterName, wizardConfig, groupModeEnabled } = useSettingsStore.getState();

    // Create a default run if none exists
    const now = Date.now();

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
        status: 'in_progress',
        endedAt: null,
        totalTimeMs: null,
        isGroupRun: groupModeEnabled,
      };
      set((state) => ({
        currentRun: run,
        splits: [],
        timer: {
          ...state.timer,
          isRunning: true,
          startTime: now - state.timer.elapsedMs,
          splits: [],
          // Restart town/hideout tracking if still in one
          townEnteredAt: state.timer.inTown ? now : state.timer.townEnteredAt,
          hideoutEnteredAt: state.timer.inHideout ? now : state.timer.hideoutEnteredAt,
        },
      }));
    } else {
      set((state) => ({
        timer: {
          ...state.timer,
          isRunning: true,
          startTime: now - state.timer.elapsedMs,
          // Restart town/hideout tracking if still in one
          townEnteredAt: state.timer.inTown ? now : state.timer.townEnteredAt,
          hideoutEnteredAt: state.timer.inHideout ? now : state.timer.hideoutEnteredAt,
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
    const { timer } = get();
    const now = Date.now();

    // Flush any in-progress town/hideout time so it doesn't keep accumulating while paused
    let newTownTimeMs = timer.townTimeMs;
    if (timer.inTown && timer.townEnteredAt !== null) {
      newTownTimeMs += now - timer.townEnteredAt;
    }
    let newHideoutTimeMs = timer.hideoutTimeMs;
    if (timer.inHideout && timer.hideoutEnteredAt !== null) {
      newHideoutTimeMs += now - timer.hideoutEnteredAt;
    }

    // Finalize open town visit on pause
    let newTownVisits = timer.townVisits;
    if (timer.inTown) {
      newTownVisits = timer.townVisits.map((v) =>
        v.exitedAt === null
          ? { ...v, exitedAt: now, durationMs: now - v.enteredAt }
          : v
      );
    }

    // Flush endgame town/map time on pause
    let newEndgameTownTimeMs = timer.endgameTownTimeMs;
    let newCurrentMapEnteredAt = timer.currentMapEnteredAt;
    let newCurrentMapElapsedMs = timer.currentMapElapsedMs;

    if (timer.isInEndgame) {
      if (timer.inTown && timer.townEnteredAt !== null) {
        newEndgameTownTimeMs += now - timer.townEnteredAt;
      }
      if (timer.inHideout && timer.hideoutEnteredAt !== null) {
        newEndgameTownTimeMs += now - timer.hideoutEnteredAt;
      }
      if (newCurrentMapEnteredAt !== null) {
        newCurrentMapElapsedMs += now - newCurrentMapEnteredAt;
        newCurrentMapEnteredAt = null;
      }
    }

    set({
      timer: {
        ...timer,
        isRunning: false,
        townTimeMs: newTownTimeMs,
        hideoutTimeMs: newHideoutTimeMs,
        // Clear timestamps so time doesn't accumulate while paused
        townEnteredAt: null,
        hideoutEnteredAt: null,
        townVisits: newTownVisits,
        // Endgame
        endgameTownTimeMs: newEndgameTownTimeMs,
        currentMapEnteredAt: newCurrentMapEnteredAt,
        currentMapElapsedMs: newCurrentMapElapsedMs,
      },
    });
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

    // Only start tracking town/hideout time if the timer is running
    const trackingActive = timer.isRunning;

    // Town visit tracking: finalize open visit when leaving town
    let newTownVisits = timer.townVisits;
    if (timer.inTown && !isTown && trackingActive) {
      newTownVisits = timer.townVisits.map((v) =>
        v.exitedAt === null
          ? { ...v, exitedAt: now, durationMs: now - v.enteredAt }
          : v
      );
    }

    // Start a new town visit when entering a town
    if (isTown && !timer.inTown && trackingActive) {
      const newVisit = {
        zoneName,
        enteredAt: now,
        exitedAt: null,
        durationMs: 0,
        afterSplitIndex: timer.splits.length - 1,
      };
      newTownVisits = [...newTownVisits, newVisit];
    }

    // Boss encounter finalization
    let newActiveBoss = timer.activeBossEncounter;
    let newBossEncounters = timer.bossEncounters;
    if (newActiveBoss && !isTown && !isHideout) {
      if (zoneName === newActiveBoss.zoneName) {
        // Returning to the boss zone from town — continue the fight
      } else {
        // Entering a different non-town zone — fight is over
        // Subtract town time that occurred during the encounter
        const townDuringFight = newTownVisits
          .filter((v) => v.enteredAt >= newActiveBoss!.startedAt && v.exitedAt !== null)
          .reduce((sum, v) => sum + v.durationMs, 0);
        const fightDuration = (now - newActiveBoss.startedAt) - townDuringFight;

        newBossEncounters = [
          ...timer.bossEncounters,
          { ...newActiveBoss, endedAt: now, durationMs: fightDuration },
        ];
        newActiveBoss = null;
      }
    }

    // Endgame map tracking
    let newEndgameTownTimeMs = timer.endgameTownTimeMs;
    let newCurrentMapEnteredAt = timer.currentMapEnteredAt;
    let newCurrentMapElapsedMs = timer.currentMapElapsedMs;
    let newCurrentMapZone = timer.currentMapZone;
    let newCurrentMapAreaLevel = timer.currentMapAreaLevel;
    let newCurrentMapSeed = timer.currentMapSeed;
    let newMapCount = timer.mapCount;
    let newCompletedMaps = timer.completedMaps;

    if (timer.isInEndgame && trackingActive) {
      const wasTownOrHideout = timer.inTown || timer.inHideout;

      // Accumulate endgame town/hideout time when leaving town
      if (wasTownOrHideout && !(isTown || isHideout)) {
        if (timer.townEnteredAt !== null) {
          newEndgameTownTimeMs += now - timer.townEnteredAt;
        }
        if (timer.hideoutEnteredAt !== null) {
          newEndgameTownTimeMs += now - timer.hideoutEnteredAt;
        }
      }

      if (isTown || isHideout) {
        // Entering town/hideout FROM a map: flush map time
        if (newCurrentMapEnteredAt !== null) {
          newCurrentMapElapsedMs += now - newCurrentMapEnteredAt;
          newCurrentMapEnteredAt = null;
        }
      } else {
        // Entering a non-town zone
        const latestSeed = timer.latestSeed;
        if (latestSeed != null && latestSeed !== 1) {
          if (newCurrentMapSeed === latestSeed) {
            // Same seed — portal-back to same map or sub-area
            if (newCurrentMapEnteredAt === null) {
              // Returning from town — resume map timer
              newCurrentMapEnteredAt = now;
            }
            // Update zone name (could be boss arena / sub-area)
            newCurrentMapZone = zoneName;
          } else {
            // Different seed — new map instance
            // Log the completed map before overwriting
            if (newCurrentMapZone != null) {
              let finalMapTime = newCurrentMapElapsedMs;
              if (newCurrentMapEnteredAt !== null) {
                finalMapTime += now - newCurrentMapEnteredAt;
              }
              newCompletedMaps = [...newCompletedMaps, {
                zone: newCurrentMapZone,
                areaLevel: newCurrentMapAreaLevel,
                timeMs: finalMapTime,
                completedAt: now,
              }];
            }
            newMapCount += 1;
            newCurrentMapEnteredAt = now;
            newCurrentMapElapsedMs = 0;
            newCurrentMapZone = zoneName;
            newCurrentMapAreaLevel = timer.latestAreaLevel;
            newCurrentMapSeed = latestSeed;
          }
        } else if (newCurrentMapSeed === null && latestSeed == null) {
          // No seed info yet — first non-town entry in endgame, wait for generating_level
        }
      }
    }

    set((state) => ({
      timer: {
        ...state.timer,
        currentZone: zoneName,
        inTown: isTown,
        inHideout: isHideout,
        townEnteredAt: isTown && trackingActive ? now : null,
        hideoutEnteredAt: isHideout && trackingActive ? now : null,
        townTimeMs: newTownTimeMs,
        hideoutTimeMs: newHideoutTimeMs,
        townVisits: newTownVisits,
        activeBossEncounter: newActiveBoss,
        bossEncounters: newBossEncounters,
        // Endgame map tracking
        endgameTownTimeMs: newEndgameTownTimeMs,
        currentMapEnteredAt: newCurrentMapEnteredAt,
        currentMapElapsedMs: newCurrentMapElapsedMs,
        currentMapZone: newCurrentMapZone,
        currentMapAreaLevel: newCurrentMapAreaLevel,
        currentMapSeed: newCurrentMapSeed,
        mapCount: newMapCount,
        completedMaps: newCompletedMaps,
      },
    }));
  },

  startBossEncounter: (bossName: string) => {
    const { timer } = get();
    if (!timer.isRunning) return;
    // Guard: don't start duplicate active encounter for the same boss
    if (timer.activeBossEncounter?.bossName === bossName) return;
    // Guard: don't start if this boss was already encountered this run
    if (timer.bossEncounters.some((e) => e.bossName === bossName)) return;

    const encounter = {
      bossName,
      zoneName: timer.currentZone ?? '',
      startedAt: Date.now(),
      endedAt: null,
      durationMs: null,
      afterSplitIndex: timer.splits.length - 1,
    };

    set((state) => ({
      timer: { ...state.timer, activeBossEncounter: encounter },
    }));
  },

  incrementDeathCount: () => {
    set((state) => ({
      timer: {
        ...state.timer,
        deathCount: state.timer.deathCount + 1,
        endgameDeathCount: state.timer.isInEndgame
          ? state.timer.endgameDeathCount + 1
          : state.timer.endgameDeathCount,
      },
    }));
  },

  setRunId: (id) => {
    set((state) => ({
      currentRun: state.currentRun ? { ...state.currentRun, id } : null,
    }));
  },

  setCurrentLevel: (level) => set({ currentLevel: level }),

  enterEndgame: (finalTimeMs: number) => {
    const { currentRun } = get();
    if (!currentRun) return;

    // Mark the run as completed but keep timer running
    const endedRun: Run = {
      ...currentRun,
      isCompleted: true,
      status: 'completed',
      endedAt: new Date().toISOString(),
      totalTimeMs: finalTimeMs,
    };

    set((state) => ({
      currentRun: endedRun,
      runs: [...state.runs, endedRun],
      timer: {
        ...state.timer,
        // Timer keeps running — do NOT set isRunning: false
        isInEndgame: true,
        act10FinalTimeMs: finalTimeMs,
        mapCount: 0,
        currentMapEnteredAt: null,
        currentMapElapsedMs: 0,
        currentMapZone: null,
        currentMapAreaLevel: null,
        currentMapSeed: null,
        endgameTownTimeMs: 0,
        endgameDeathCount: 0,
      },
    }));
  },

  setLatestSeed: (seed: number, areaLevel?: number) => {
    set((state) => ({
      timer: { ...state.timer, latestSeed: seed, ...(areaLevel != null ? { latestAreaLevel: areaLevel } : {}) },
    }));
  },

  startMappingSession: () => {
    const now = Date.now();
    set({
      currentRun: null,
      currentLevel: 1,
      splits: [],
      timer: {
        ...initialTimerState,
        isRunning: true,
        startTime: now,
        isInEndgame: true,
        isMappingSession: true,
      },
    });
  },

  stopMappingSession: () => {
    set({
      currentRun: null,
      currentLevel: 1,
      splits: [],
      timer: initialTimerState,
    });
  },

  // Data loading
  setRuns: (runs) => set({ runs }),
  setSplits: (splits) => set({ splits }),
  setPersonalBests: (pbs) => set({ personalBests: pbs }),
  setGoldSplits: (golds) => set({ goldSplits: golds }),
  loadComparisonSplits: async (runId: number) => {
    try {
      const splits = await invoke<Split[]>('get_splits', { runId });
      const map = new Map<string, number>();
      for (const s of splits) {
        map.set(s.breakpointName, s.splitTimeMs);
      }
      set({ comparisonSplits: map });
    } catch (error) {
      console.error('[RunStore] Failed to load comparison splits:', error);
      set({ comparisonSplits: new Map() });
    }
  },
  clearComparisonSplits: () => set({ comparisonSplits: new Map() }),

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
            const key = `${pb.category}-${pb.class}-${split.breakpointName}`;
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
        const key = `${gold.category}-${gold.class}-${gold.breakpointName}`;
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
