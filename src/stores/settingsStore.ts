import { create } from 'zustand';
import type { Breakpoint, Settings, ViewMode } from '../types';
import { defaultBreakpoints } from '../config/breakpoints';

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
  setCurrentView: (view: ViewMode) => void;
  loadSettings: (settings: Partial<Settings>) => void;
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

  setCurrentView: (view) => set({ currentView: view }),

  loadSettings: (settings) => set((state) => ({
    ...state,
    ...settings,
  })),
}));
