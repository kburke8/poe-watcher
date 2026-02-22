import { create } from 'zustand';
import type { PracticeMode, PracticeZone, PracticeAttempt } from '../types';
import { defaultBreakpoints } from '../config/breakpoints';

const PRACTICE_STORAGE_KEY = 'poe-watcher-practice';

// Build a lookup: for a given zone (by zoneName+act), find the next zone-trigger
// breakpoint in game progression order. This is used in single zone mode so the
// attempt completes when you EXIT the zone (i.e. enter the next one).
function getNextZone(zoneName: string, act: number): PracticeZone | null {
  const zoneBreakpoints = defaultBreakpoints.filter(
    bp => bp.trigger.type === 'zone' && bp.trigger.zoneName && bp.trigger.act
  );
  const idx = zoneBreakpoints.findIndex(
    bp => bp.trigger.zoneName!.toLowerCase() === zoneName.toLowerCase()
      && bp.trigger.act === act
  );
  if (idx === -1 || idx + 1 >= zoneBreakpoints.length) return null;
  const next = zoneBreakpoints[idx + 1];
  return {
    name: next.name,
    zoneName: next.trigger.zoneName!,
    act: next.trigger.act!,
  };
}

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

  // Derived - get the "exit zone" (zone after the selected one) for single zone mode
  getExitZone: () => PracticeZone | null;
  // Derived - get the exit zone for route mode (zone after the last selected zone)
  getRouteExitZone: () => PracticeZone | null;

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
    const { selectedZones } = get();
    if (selectedZones.length === 0) return;

    // Both modes: just arm the session. The timer auto-starts
    // when you enter the target/first zone so you can chain-run
    // without touching the UI.
    set({
      isActive: true,
      timer: {
        ...initialTimerState,
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

  // Derived
  getExitZone: () => {
    const { selectedZones, mode } = get();
    if (mode !== 'single_zone' || selectedZones.length === 0) return null;
    return getNextZone(selectedZones[0].zoneName, selectedZones[0].act);
  },

  getRouteExitZone: () => {
    const { selectedZones, mode } = get();
    if (mode !== 'route' || selectedZones.length === 0) return null;
    const lastZone = selectedZones[selectedZones.length - 1];
    return getNextZone(lastZone.zoneName, lastZone.act);
  },

  // Zone progression
  handleZoneEnter: (zoneName: string) => {
    const { timer, selectedZones, mode, isActive } = get();
    if (!isActive || selectedZones.length === 0) return;

    const normalizedZone = zoneName.toLowerCase();

    if (mode === 'single_zone') {
      // Single zone mode has two triggers:
      // 1. Entering the target zone  → auto-start the timer
      // 2. Entering the exit zone    → record attempt, reset to waiting
      // This lets you chain-run the zone without touching the UI.
      const targetZone = selectedZones[0];
      const exitZone = getNextZone(targetZone.zoneName, targetZone.act);
      if (!exitZone) return;

      if (!timer.isRunning && targetZone.zoneName.toLowerCase() === normalizedZone) {
        // Entering the target zone → start the timer
        const now = Date.now();
        set({
          timer: {
            ...initialTimerState,
            isRunning: true,
            startTime: now,
          },
        });
        return;
      }

      if (timer.isRunning && exitZone.zoneName.toLowerCase() === normalizedZone) {
        // Entering the exit zone → record the attempt, reset to waiting
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
            // Reset timer but stay armed — next zone entry starts it again
            timer: {
              ...initialTimerState,
            },
          };
        });
        get().saveToStorage();
      }
    } else {
      // Route mode — three phases:
      // 1. Auto-start on first zone
      // 2. Progression through remaining zones
      // 3. Completion on exit zone (zone after last selected)
      const firstZone = selectedZones[0];
      const lastZone = selectedZones[selectedZones.length - 1];
      const exitZone = getNextZone(lastZone.zoneName, lastZone.act);

      // Phase 1: Auto-start when entering the first zone
      if (!timer.isRunning && firstZone.zoneName.toLowerCase() === normalizedZone) {
        const now = Date.now();
        set({
          timer: {
            ...initialTimerState,
            isRunning: true,
            startTime: now,
            // First zone is visited on entry, advance to next
            currentZoneIndex: 1,
            completedZones: [firstZone.name],
          },
        });
        return;
      }

      if (!timer.isRunning) return;

      // Phase 3: Completion when entering exit zone (all selected zones visited)
      if (timer.currentZoneIndex >= selectedZones.length && exitZone &&
          exitZone.zoneName.toLowerCase() === normalizedZone) {
        const actualElapsedMs = timer.startTime ? Date.now() - timer.startTime : timer.elapsedMs;

        const attempt: PracticeAttempt = {
          id: Date.now(),
          timeMs: actualElapsedMs,
          completedAt: new Date().toISOString(),
          zones: timer.completedZones,
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
            // Reset to armed/waiting — next first-zone entry starts again
            timer: {
              ...initialTimerState,
            },
          };
        });
        get().saveToStorage();
        return;
      }

      // Phase 2: Progression through remaining zones
      const nextIndex = timer.currentZoneIndex;
      if (nextIndex < selectedZones.length) {
        const nextZone = selectedZones[nextIndex];
        if (nextZone.zoneName.toLowerCase() === normalizedZone) {
          set((state) => ({
            timer: {
              ...state.timer,
              currentZoneIndex: nextIndex + 1,
              completedZones: [...state.timer.completedZones, nextZone.name],
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
