import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Breakpoint, Settings, ViewMode, WizardConfig, HotkeySettings } from '../types';
import { DEFAULT_HOTKEYS } from '../types';
import {
  defaultBreakpoints,
  applySpeedrunPreset,
  applyMinimalPreset,
  applyTownsOnlyPreset,
  resetToDefault,
  speedrunEnabledBreakpoints,
} from '../config/breakpoints';
import { generateBreakpoints } from '../config/wizardRoutes';
import { useRunStore } from './runStore';

interface SettingsState extends Settings {
  // UI state
  currentView: ViewMode;
  pendingSnapshotRunId: number | null;
  pendingSettingsTab: string | null;
  // Runtime-only state (not persisted)
  overlayOpen: boolean;
  // Hotkey settings
  hotkeys: HotkeySettings;
  // Active comparison run
  activeComparisonRunId: number | null;
  activeComparisonLabel: string | null;
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
  navigateToSnapshot: (runId: number) => void;
  navigateToSettingsTab: (tab: string) => void;
  clearPendingSettingsTab: () => void;
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
  setOverlayOpen: (open: boolean) => void;
  // Hotkey actions
  loadHotkeys: () => Promise<void>;
  setHotkeys: (hotkeys: HotkeySettings) => void;
  resetHotkeys: () => Promise<void>;
  // Group mode
  setGroupModeEnabled: (enabled: boolean) => void;
  // Display toggles
  setShowTownVisits: (show: boolean) => void;
  // Comparison
  setActiveComparison: (runId: number | null, label?: string | null) => void;
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
  pendingSnapshotRunId: null,
  pendingSettingsTab: null,
  // Overlay config defaults
  overlayScale: 'small',
  overlayFontSize: 'medium',
  overlayShowTimer: true,
  overlayShowZone: false,
  overlayShowLastSplit: false,
  overlayShowBreakpoints: false,
  overlayBreakpointCount: 3,
  overlayBgOpacity: 0.9,
  overlayAccentColor: 'transparent',
  overlayAlwaysOnTop: true,
  // Group mode
  groupModeEnabled: false,
  // Display toggles
  showTownVisits: true,
  // Runtime-only
  overlayOpen: false,
  // Hotkey settings
  hotkeys: { ...DEFAULT_HOTKEYS },
  // Active comparison
  activeComparisonRunId: null,
  activeComparisonLabel: null,
  // Actions
  setLogPath: (path) => set({ poeLogPath: path }),
  setAccountName: (name) => set({ accountName: name }),
  setTestCharacterName: (name) => set({ testCharacterName: name }),
  setCheckUpdates: (enabled) => set({ checkUpdates: enabled }),
  setOverlayEnabled: (enabled) => set({ overlayEnabled: enabled }),
  setOverlayOpacity: (opacity) => set({ overlayOpacity: opacity }),
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
  setBreakpoints: (breakpoints) => {
    set({ breakpoints });
    useRunStore.getState().resetRun();
  },

  toggleBreakpoint: (name) => {
    set((state) => ({
      breakpoints: state.breakpoints.map((bp) =>
        bp.name === name ? { ...bp, isEnabled: !bp.isEnabled } : bp
      ),
    }));
    useRunStore.getState().resetRun();
  },

  toggleSnapshotCapture: (name) => set((state) => ({
    breakpoints: state.breakpoints.map((bp) =>
      bp.name === name ? { ...bp, captureSnapshot: !bp.captureSnapshot } : bp
    ),
  })),

  setCurrentView: (view) => set({ currentView: view, pendingSnapshotRunId: null }),
  navigateToSnapshot: (runId) => set({ currentView: 'snapshots', pendingSnapshotRunId: runId }),
  navigateToSettingsTab: (tab) => set({ currentView: 'settings', pendingSettingsTab: tab }),
  clearPendingSettingsTab: () => set({ pendingSettingsTab: null }),

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

  setAllBreakpoints: (enabled) => {
    set((state) => ({
      breakpoints: state.breakpoints.map((bp) => ({ ...bp, isEnabled: enabled })),
    }));
    useRunStore.getState().resetRun();
  },

  setActBreakpoints: (act, enabled) => {
    set((state) => ({
      breakpoints: state.breakpoints.map((bp) =>
        bp.trigger.act === act ? { ...bp, isEnabled: enabled } : bp
      ),
    }));
    useRunStore.getState().resetRun();
  },

  applySpeedrunPreset: () => {
    set((state) => {
      const newBreakpoints = applySpeedrunPreset(state.breakpoints);
      return { breakpoints: newBreakpoints };
    });
    useRunStore.getState().resetRun();
  },

  applyMinimalPreset: () => {
    set((state) => ({
      breakpoints: applyMinimalPreset(state.breakpoints),
    }));
    useRunStore.getState().resetRun();
  },

  applyTownsOnlyPreset: () => {
    set((state) => ({
      breakpoints: applyTownsOnlyPreset(state.breakpoints),
    }));
    useRunStore.getState().resetRun();
  },

  resetBreakpoints: () => {
    // Clear localStorage to remove any corrupted data
    try {
      localStorage.removeItem('poe-watcher-breakpoints');
    } catch (e) {
      console.error('[Store] Failed to clear localStorage:', e);
    }
    const defaults = resetToDefault();
    set({ breakpoints: defaults });
    useRunStore.getState().resetRun();
  },

  // Wizard config
  setWizardConfig: (config: WizardConfig) => {
    const breakpoints = generateBreakpoints(config);
    set({ wizardConfig: config, breakpoints });
    useRunStore.getState().resetRun();
  },

  clearWizardConfig: () => {
    set({ wizardConfig: undefined });
    useRunStore.getState().resetRun();
  },

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
  setOverlayOpen: (open) => set({ overlayOpen: open }),
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

  // Hotkey actions
  loadHotkeys: async () => {
    try {
      const hotkeys = await invoke<HotkeySettings>('get_hotkeys');
      set({ hotkeys });
    } catch (error) {
      console.error('[settingsStore] Failed to load hotkeys:', error);
    }
  },
  setHotkeys: (hotkeys) => set({ hotkeys }),
  resetHotkeys: async () => {
    try {
      await invoke('update_hotkeys', { hotkeys: DEFAULT_HOTKEYS });
      set({ hotkeys: { ...DEFAULT_HOTKEYS } });
    } catch (error) {
      console.error('[settingsStore] Failed to reset hotkeys:', error);
      throw error;
    }
  },
  // Group mode
  setGroupModeEnabled: (enabled) => set({ groupModeEnabled: enabled }),
  // Display toggles
  setShowTownVisits: (show) => set({ showTownVisits: show }),
  // Comparison
  setActiveComparison: (runId, label = null) => set({
    activeComparisonRunId: runId,
    activeComparisonLabel: label,
  }),
}));
