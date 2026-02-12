import { create } from 'zustand';
import type { Breakpoint, Settings, ViewMode, WizardConfig } from '../types';
import {
  defaultBreakpoints,
  applySpeedrunPreset,
  applyMinimalPreset,
  applyTownsOnlyPreset,
  resetToDefault,
  speedrunEnabledBreakpoints,
} from '../config/breakpoints';
import { generateBreakpoints } from '../config/wizardRoutes';

interface SettingsState extends Settings {
  // UI state
  currentView: ViewMode;
  // Runtime-only state (not persisted)
  overlayOpen: boolean;
  overlayPreviewActive: boolean;

  // Actions
  setLogPath: (path: string) => void;
  setAccountName: (name: string) => void;
  setTestCharacterName: (name: string) => void;
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
  // Wizard
  setWizardConfig: (config: WizardConfig) => void;
  clearWizardConfig: () => void;
  // Preset detection helpers
  getCurrentPresetName: () => string;
  getEnabledBreakpointNames: () => string[];
  // Overlay config
  setOverlayScale: (scale: 'small' | 'medium' | 'large') => void;
  setOverlayFontSize: (size: 'small' | 'medium' | 'large') => void;
  setOverlayShowTimer: (show: boolean) => void;
  setOverlayShowZone: (show: boolean) => void;
  setOverlayShowLastSplit: (show: boolean) => void;
  setOverlayShowBreakpoints: (show: boolean) => void;
  setOverlayBreakpointCount: (count: number) => void;
  setOverlayBgOpacity: (opacity: number) => void;
  setOverlayAccentColor: (color: string) => void;
  setOverlayAlwaysOnTop: (enabled: boolean) => void;
  setOverlayLocked: (locked: boolean) => void;
  setOverlayOpen: (open: boolean) => void;
  setOverlayPreviewActive: (active: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Default settings
  poeLogPath: '',
  accountName: '',
  testCharacterName: import.meta.env.DEV ? 'beerdz_layoutguy' : '',
  checkUpdates: true,
  overlayEnabled: true,
  overlayOpacity: 0.8,
  soundEnabled: true,
  breakpoints: defaultBreakpoints,
  wizardConfig: undefined,
  currentView: 'timer',
  // Overlay config defaults
  overlayScale: 'medium',
  overlayFontSize: 'medium',
  overlayShowTimer: true,
  overlayShowZone: true,
  overlayShowLastSplit: true,
  overlayShowBreakpoints: true,
  overlayBreakpointCount: 3,
  overlayBgOpacity: 0.9,
  overlayAccentColor: 'transparent',
  overlayAlwaysOnTop: true,
  overlayLocked: false,
  // Runtime-only
  overlayOpen: false,
  overlayPreviewActive: false,

  // Actions
  setLogPath: (path) => set({ poeLogPath: path }),
  setAccountName: (name) => set({ accountName: name }),
  setTestCharacterName: (name) => set({ testCharacterName: name }),
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
    const newBreakpoints = applySpeedrunPreset(state.breakpoints);
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
    } catch (e) {
      console.error('[Store] Failed to clear localStorage:', e);
    }
    const defaults = resetToDefault();
    return set({
      breakpoints: defaults,
    });
  },

  // Wizard config
  setWizardConfig: (config: WizardConfig) => {
    const breakpoints = generateBreakpoints(config);
    return set({ wizardConfig: config, breakpoints });
  },

  clearWizardConfig: () => set({ wizardConfig: undefined }),

  // Overlay config setters
  setOverlayScale: (scale) => set({ overlayScale: scale }),
  setOverlayFontSize: (size) => set({ overlayFontSize: size }),
  setOverlayShowTimer: (show) => set({ overlayShowTimer: show }),
  setOverlayShowZone: (show) => set({ overlayShowZone: show }),
  setOverlayShowLastSplit: (show) => set({ overlayShowLastSplit: show }),
  setOverlayShowBreakpoints: (show) => set({ overlayShowBreakpoints: show }),
  setOverlayBreakpointCount: (count) => set({ overlayBreakpointCount: count }),
  setOverlayBgOpacity: (opacity) => set({ overlayBgOpacity: opacity }),
  setOverlayAccentColor: (color) => set({ overlayAccentColor: color }),
  setOverlayAlwaysOnTop: (enabled) => set({ overlayAlwaysOnTop: enabled }),
  setOverlayLocked: (locked) => set({ overlayLocked: locked }),
  setOverlayOpen: (open) => set({ overlayOpen: open }),
  setOverlayPreviewActive: (active) => set({ overlayPreviewActive: active }),

  // Detect current preset based on enabled breakpoints
  getCurrentPresetName: () => {
    const state = get();
    const enabledNames = state.breakpoints
      .filter((bp) => bp.isEnabled)
      .map((bp) => bp.name);

    // Check if it matches speedrun preset
    const speedrunSet = new Set(speedrunEnabledBreakpoints);
    const enabledSet = new Set(enabledNames);
    if (
      speedrunSet.size === enabledSet.size &&
      [...speedrunSet].every((name) => enabledSet.has(name))
    ) {
      return 'speedrun';
    }

    // Check if it matches minimal preset (only act transitions)
    const actBreakpoints = state.breakpoints.filter((bp) => bp.type === 'act');
    const minimalNames = actBreakpoints.map((bp) => bp.name);
    const minimalSet = new Set(minimalNames);
    if (
      minimalSet.size === enabledSet.size &&
      [...minimalSet].every((name) => enabledSet.has(name))
    ) {
      return 'minimal';
    }

    // Check if no breakpoints are enabled
    if (enabledNames.length === 0) {
      return 'none';
    }

    // Otherwise it's a custom configuration
    return 'custom';
  },

  // Get list of enabled breakpoint names
  getEnabledBreakpointNames: () => {
    const state = get();
    return state.breakpoints
      .filter((bp) => bp.isEnabled)
      .map((bp) => bp.name);
  },
}));
