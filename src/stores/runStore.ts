import { create } from 'zustand';
import type { Run, Split, SplitTime, TimerState } from '../types';

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

    const category = `${currentRun.category}-${currentRun.class}`;
    const pbTime = personalBests.get(`${category}-${splitData.breakpointName}`);
    const goldTime = goldSplits.get(`${category}-${splitData.breakpointName}`);

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

    // Create a default run if none exists
    if (!currentRun) {
      const run: Run = {
        id: Date.now(),
        category: 'any%',
        class: 'Unknown',
        character: 'Unknown',
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
}));
