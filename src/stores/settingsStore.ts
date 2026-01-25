import { create } from 'zustand';
import type { Breakpoint, Settings, ViewMode } from '../types';
import {
  defaultBreakpoints,
  applySpeedrunPreset,
  applyMinimalPreset,
  applyTownsOnlyPreset,
  resetToDefault,
} from '../config/breakpoints';

interface SettingsState extends Settings {
  // UI state
  currentView: ViewMode;

  // Actions
  setLogPath: (path: string) => void;
  setAccountName: (name: string) => void;
  setCheckUpdates: (enabled: boolean) => void;
  setOverlayEnabled: (enabled: boolean) => void;
  setOverlayOpacity: (opacity: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setBreakpoints: (breakpoints: Breakpoint[]) => void;
  toggleBreakpoint: (name: string) => void;
  toggleSnapshotCapture: (name: string) => void;
  setCurrentView: (view: ViewMode) => void;
  loadSettings: (settings: Partial<Settings>) => void;
  // Breakpoint management
  moveBreakpoint: (name: string, direction: 'up' | 'down') => void;
  setAllBreakpoints: (enabled: boolean) => void;
  setActBreakpoints: (act: number, enabled: boolean) => void;
  // Presets
  applySpeedrunPreset: () => void;
  applyMinimalPreset: () => void;
  applyTownsOnlyPreset: () => void;
  resetBreakpoints: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  // Default settings
  poeLogPath: '',
  accountName: '',
  checkUpdates: true,
  overlayEnabled: false,
  overlayOpacity: 0.8,
  soundEnabled: true,
  breakpoints: defaultBreakpoints,
  currentView: 'timer',

  // Actions
  setLogPath: (path) => set({ poeLogPath: path }),
  setAccountName: (name) => set({ accountName: name }),
  setCheckUpdates: (enabled) => set({ checkUpdates: enabled }),
  setOverlayEnabled: (enabled) => set({ overlayEnabled: enabled }),
  setOverlayOpacity: (opacity) => set({ overlayOpacity: opacity }),
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
  setBreakpoints: (breakpoints) => set({ breakpoints }),

  toggleBreakpoint: (name) => set((state) => ({
    breakpoints: state.breakpoints.map((bp) =>
      bp.name === name ? { ...bp, isEnabled: !bp.isEnabled } : bp
    ),
  })),

  toggleSnapshotCapture: (name) => set((state) => ({
    breakpoints: state.breakpoints.map((bp) =>
      bp.name === name ? { ...bp, captureSnapshot: !bp.captureSnapshot } : bp
    ),
  })),

  setCurrentView: (view) => set({ currentView: view }),

  loadSettings: (settings) => set((state) => ({
    ...state,
    ...settings,
  })),

  moveBreakpoint: (name, direction) => set((state) => {
    const breakpoints = [...state.breakpoints];
    const index = breakpoints.findIndex((bp) => bp.name === name);
    if (index === -1) return state;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= breakpoints.length) return state;

    // Swap positions
    [breakpoints[index], breakpoints[newIndex]] = [breakpoints[newIndex], breakpoints[index]];
    return { breakpoints };
  }),

  setAllBreakpoints: (enabled) => set((state) => ({
    breakpoints: state.breakpoints.map((bp) => ({ ...bp, isEnabled: enabled })),
  })),

  setActBreakpoints: (act, enabled) => set((state) => ({
    breakpoints: state.breakpoints.map((bp) =>
      bp.trigger.act === act ? { ...bp, isEnabled: enabled } : bp
    ),
  })),

  applySpeedrunPreset: () => set((state) => {
    console.log('[Store] applySpeedrunPreset called, current breakpoints:', state.breakpoints.length);
    const newBreakpoints = applySpeedrunPreset(state.breakpoints);
    console.log('[Store] New breakpoints:', newBreakpoints.length, 'enabled:', newBreakpoints.filter(bp => bp.isEnabled).length);
    return { breakpoints: newBreakpoints };
  }),

  applyMinimalPreset: () => set((state) => ({
    breakpoints: applyMinimalPreset(state.breakpoints),
  })),

  applyTownsOnlyPreset: () => set((state) => ({
    breakpoints: applyTownsOnlyPreset(state.breakpoints),
  })),

  resetBreakpoints: () => {
    // Clear localStorage to remove any corrupted data
    try {
      localStorage.removeItem('poe-watcher-breakpoints');
      console.log('[Store] Cleared breakpoints from localStorage');
    } catch (e) {
      console.error('[Store] Failed to clear localStorage:', e);
    }
    const defaults = resetToDefault();
    console.log('[Store] Resetting to', defaults.length, 'default breakpoints');
    return set({
      breakpoints: defaults,
    });
  },
}));
