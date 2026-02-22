import { create } from 'zustand';
import type { PracticeMode, PracticeZone, PracticeAttempt } from '../types';

const PRACTICE_STORAGE_KEY = 'poe-watcher-practice';

interface PracticeTimerState {
  isRunning: boolean;
  startTime: number | null;
  elapsedMs: number;
  // Track progress through a route
  currentZoneIndex: number;
  completedZones: string[];
  deathCount: number;
}

interface PracticeState {
  // Configuration
  mode: PracticeMode;
  selectedZones: PracticeZone[];
  isActive: boolean; // Whether a practice session is currently running

  // Timer
  timer: PracticeTimerState;

  // History
  attempts: PracticeAttempt[];
  bestTimeMs: number | null;

  // Actions - Configuration
  setMode: (mode: PracticeMode) => void;
  setSelectedZones: (zones: PracticeZone[]) => void;
  addZone: (zone: PracticeZone) => void;
  removeZone: (zoneName: string) => void;
  moveZone: (index: number, direction: 'up' | 'down') => void;
  clearZones: () => void;

  // Actions - Timer
  startPractice: () => void;
  stopPractice: () => void;
  resetPractice: () => void;
  updateElapsed: (ms: number) => void;
  incrementDeathCount: () => void;

  // Actions - Zone progression (called by useTauriEvents)
  handleZoneEnter: (zoneName: string) => void;

  // Actions - History
  clearAttempts: () => void;
  loadFromStorage: () => void;
  saveToStorage: () => void;
}

const initialTimerState: PracticeTimerState = {
  isRunning: false,
  startTime: null,
  elapsedMs: 0,
  currentZoneIndex: 0,
  completedZones: [],
  deathCount: 0,
};

export const usePracticeStore = create<PracticeState>((set, get) => ({
  mode: 'single_zone',
  selectedZones: [],
  isActive: false,
  timer: initialTimerState,
  attempts: [],
  bestTimeMs: null,

  // Configuration
  setMode: (mode) => {
    set({ mode, selectedZones: [], attempts: [], bestTimeMs: null });
    get().saveToStorage();
  },

  setSelectedZones: (zones) => {
    set({ selectedZones: zones, attempts: [], bestTimeMs: null });
    get().saveToStorage();
  },

  addZone: (zone) => {
    const { selectedZones, mode } = get();
    // In single_zone mode, replace the selection
    if (mode === 'single_zone') {
      set({ selectedZones: [zone], attempts: [], bestTimeMs: null });
    } else {
      // In route mode, append if not already selected
      if (!selectedZones.some(z => z.zoneName === zone.zoneName && z.act === zone.act)) {
        set({ selectedZones: [...selectedZones, zone], attempts: [], bestTimeMs: null });
      }
    }
    get().saveToStorage();
  },

  removeZone: (zoneName) => {
    set((state) => ({
      selectedZones: state.selectedZones.filter(z => z.zoneName !== zoneName),
      attempts: [],
      bestTimeMs: null,
    }));
    get().saveToStorage();
  },

  moveZone: (index, direction) => {
    set((state) => {
      const zones = [...state.selectedZones];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= zones.length) return state;
      [zones[index], zones[newIndex]] = [zones[newIndex], zones[index]];
      return { selectedZones: zones };
    });
    get().saveToStorage();
  },

  clearZones: () => {
    set({ selectedZones: [], attempts: [], bestTimeMs: null });
    get().saveToStorage();
  },

  // Timer
  startPractice: () => {
    const { selectedZones, timer } = get();
    if (selectedZones.length === 0) return;

    const now = Date.now();
    set({
      isActive: true,
      timer: {
        ...timer,
        isRunning: true,
        startTime: now - timer.elapsedMs,
        // Reset zone progress on fresh start
        ...(timer.elapsedMs === 0 ? {
          currentZoneIndex: 0,
          completedZones: [],
          deathCount: 0,
        } : {}),
      },
    });
  },

  stopPractice: () => {
    set((state) => ({
      timer: {
        ...state.timer,
        isRunning: false,
      },
    }));
  },

  resetPractice: () => {
    set({
      isActive: false,
      timer: initialTimerState,
    });
  },

  updateElapsed: (ms) => {
    set((state) => ({
      timer: { ...state.timer, elapsedMs: ms },
    }));
  },

  incrementDeathCount: () => {
    set((state) => ({
      timer: { ...state.timer, deathCount: state.timer.deathCount + 1 },
    }));
  },

  // Zone progression
  handleZoneEnter: (zoneName: string) => {
    const { timer, selectedZones, mode, isActive } = get();
    if (!isActive || !timer.isRunning || selectedZones.length === 0) return;

    const normalizedZone = zoneName.toLowerCase();

    if (mode === 'single_zone') {
      // In single zone mode, entering the selected zone completes the attempt
      const targetZone = selectedZones[0];
      if (targetZone.zoneName.toLowerCase() === normalizedZone) {
        const actualElapsedMs = timer.startTime ? Date.now() - timer.startTime : timer.elapsedMs;

        const attempt: PracticeAttempt = {
          id: Date.now(),
          timeMs: actualElapsedMs,
          completedAt: new Date().toISOString(),
          zones: [targetZone.name],
          deathCount: timer.deathCount,
        };

        set((state) => {
          const newAttempts = [...state.attempts, attempt];
          const newBest = state.bestTimeMs === null
            ? actualElapsedMs
            : Math.min(state.bestTimeMs, actualElapsedMs);
          return {
            attempts: newAttempts,
            bestTimeMs: newBest,
            // Auto-reset timer for next attempt
            timer: {
              ...initialTimerState,
              isRunning: true,
              startTime: Date.now(),
            },
          };
        });
        get().saveToStorage();
      }
    } else {
      // Route mode: check if this zone matches the next expected zone
      const nextIndex = timer.currentZoneIndex;
      if (nextIndex >= selectedZones.length) return;

      const nextZone = selectedZones[nextIndex];
      if (nextZone.zoneName.toLowerCase() === normalizedZone) {
        const newCompletedZones = [...timer.completedZones, nextZone.name];
        const newIndex = nextIndex + 1;

        // Check if route is complete
        if (newIndex >= selectedZones.length) {
          const actualElapsedMs = timer.startTime ? Date.now() - timer.startTime : timer.elapsedMs;

          const attempt: PracticeAttempt = {
            id: Date.now(),
            timeMs: actualElapsedMs,
            completedAt: new Date().toISOString(),
            zones: newCompletedZones,
            deathCount: timer.deathCount,
          };

          set((state) => {
            const newAttempts = [...state.attempts, attempt];
            const newBest = state.bestTimeMs === null
              ? actualElapsedMs
              : Math.min(state.bestTimeMs, actualElapsedMs);
            return {
              attempts: newAttempts,
              bestTimeMs: newBest,
              // Auto-reset timer for next attempt
              timer: {
                ...initialTimerState,
                isRunning: true,
                startTime: Date.now(),
              },
            };
          });
          get().saveToStorage();
        } else {
          // Progress to next zone
          set((state) => ({
            timer: {
              ...state.timer,
              currentZoneIndex: newIndex,
              completedZones: newCompletedZones,
            },
          }));
        }
      }
    }
  },

  // History
  clearAttempts: () => {
    set({ attempts: [], bestTimeMs: null });
    get().saveToStorage();
  },

  loadFromStorage: () => {
    try {
      const saved = localStorage.getItem(PRACTICE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed) {
          set({
            mode: parsed.mode || 'single_zone',
            selectedZones: parsed.selectedZones || [],
            attempts: parsed.attempts || [],
            bestTimeMs: parsed.bestTimeMs ?? null,
          });
        }
      }
    } catch (e) {
      console.error('[PracticeStore] Failed to load from storage:', e);
    }
  },

  saveToStorage: () => {
    try {
      const { mode, selectedZones, attempts, bestTimeMs } = get();
      localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify({
        mode,
        selectedZones,
        attempts,
        bestTimeMs,
      }));
    } catch (e) {
      console.error('[PracticeStore] Failed to save to storage:', e);
    }
  },
}));
