import { useEffect, useRef } from 'react';
import { emit } from '@tauri-apps/api/event';
import { useRunStore } from '../stores/runStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { TimerState, Breakpoint } from '../types';

interface OverlayState {
  elapsedMs: number;
  isRunning: boolean;
  currentZone: string | null;
  lastSplit: {
    name: string;
    deltaMs: number | null;
    isBestSegment: boolean;
  } | null;
  upcomingBreakpoints: string[];
  opacity: number;
}

export function useOverlaySync() {
  const timer = useRunStore((state: { timer: TimerState }) => state.timer);
  const breakpoints = useSettingsStore((state: { breakpoints: Breakpoint[] }) => state.breakpoints);
  const overlayOpacity = useSettingsStore((state: { overlayOpacity: number }) => state.overlayOpacity);
  const overlayEnabled = useSettingsStore((state: { overlayEnabled: boolean }) => state.overlayEnabled);

  // Track previous state to avoid unnecessary updates
  const prevStateRef = useRef<string>('');

  useEffect(() => {
    // Only sync if overlay is enabled (or always sync to allow hotkey toggling)
    // We sync regardless of overlayEnabled since the overlay can be toggled via hotkey

    // Get the last split from timer
    const lastTimerSplit = timer.splits[timer.splits.length - 1] || null;

    // Get upcoming breakpoints (enabled ones that haven't been hit yet)
    const enabledBreakpoints = breakpoints.filter((bp: Breakpoint) => bp.isEnabled);
    const hitCount = timer.currentSplit;
    const upcomingBreakpoints = enabledBreakpoints
      .slice(hitCount)
      .map((bp: Breakpoint) => bp.name);

    const state: OverlayState = {
      elapsedMs: timer.elapsedMs,
      isRunning: timer.isRunning,
      currentZone: timer.currentZone,
      lastSplit: lastTimerSplit
        ? {
            name: lastTimerSplit.name,
            deltaMs: lastTimerSplit.deltaMs,
            isBestSegment: lastTimerSplit.isBestSegment,
          }
        : null,
      upcomingBreakpoints,
      opacity: overlayOpacity,
    };

    // Only emit if state has changed
    const stateStr = JSON.stringify(state);
    if (stateStr !== prevStateRef.current) {
      prevStateRef.current = stateStr;
      emit('overlay-state-update', state).catch((error) => {
        // Silently ignore errors (overlay might not be open)
        console.debug('[OverlaySync] Failed to emit state:', error);
      });
    }
  }, [timer, breakpoints, overlayOpacity, overlayEnabled]);
}
