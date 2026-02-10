import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useRunStore } from '../stores/runStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { TimerState, Breakpoint } from '../types';

interface OverlayState {
  startTime: number | null;
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

function buildOverlayState(
  timer: TimerState,
  breakpoints: Breakpoint[],
  overlayOpacity: number,
): OverlayState {
  const lastTimerSplit = timer.splits[timer.splits.length - 1] || null;
  const enabledBreakpoints = breakpoints.filter((bp: Breakpoint) => bp.isEnabled);
  const hitCount = timer.currentSplit;
  const upcomingBreakpoints = enabledBreakpoints
    .slice(hitCount)
    .map((bp: Breakpoint) => bp.name);

  return {
    startTime: timer.startTime,
    elapsedMs: timer.isRunning && timer.startTime
      ? Date.now() - timer.startTime
      : timer.elapsedMs,
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
}

function sendToOverlay(state: OverlayState) {
  invoke('sync_overlay_state', { state }).catch(() => {
    // Silently ignore - overlay might not be open
  });
}

export function useOverlaySync() {
  const timer = useRunStore((state: { timer: TimerState }) => state.timer);
  const breakpoints = useSettingsStore((state: { breakpoints: Breakpoint[] }) => state.breakpoints);
  const overlayOpacity = useSettingsStore((state: { overlayOpacity: number }) => state.overlayOpacity);

  // Track previous non-time state to detect meaningful changes
  const prevNonTimeRef = useRef<string>('');

  // Build and send current state
  const syncNow = useCallback(() => {
    const state = buildOverlayState(timer, breakpoints, overlayOpacity);
    sendToOverlay(state);
  }, [timer, breakpoints, overlayOpacity]);

  // Emit immediately on meaningful state changes (zone, splits, start/stop, etc.)
  useEffect(() => {
    const nonTimeKey = JSON.stringify({
      startTime: timer.startTime,
      isRunning: timer.isRunning,
      currentZone: timer.currentZone,
      currentSplit: timer.currentSplit,
      splitCount: timer.splits.length,
      lastSplitName: timer.splits[timer.splits.length - 1]?.name,
      opacity: overlayOpacity,
    });

    if (nonTimeKey !== prevNonTimeRef.current) {
      prevNonTimeRef.current = nonTimeKey;
      syncNow();
    }
  }, [timer, overlayOpacity, syncNow]);

  // Periodic heartbeat so overlay stays in sync even if it opens late
  useEffect(() => {
    const interval = setInterval(() => {
      syncNow();
    }, 2000);

    return () => clearInterval(interval);
  }, [syncNow]);
}
