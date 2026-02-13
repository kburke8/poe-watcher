import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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
    splitTimeMs?: number;
    segmentTimeMs?: number;
    pbSegmentTimeMs?: number | null;
    goldSegmentTimeMs?: number | null;
  } | null;
  upcomingBreakpoints: { name: string; pbTimeMs: number | null; pbSegmentTimeMs: number | null }[];
  opacity: number;
  // Display config
  scale: 'small' | 'medium' | 'large';
  fontSize: 'small' | 'medium' | 'large';
  showTimer: boolean;
  showZone: boolean;
  showLastSplit: boolean;
  showBreakpoints: boolean;
  breakpointCount: number;
  bgOpacity: number;
  accentColor: string;
  alwaysOnTop: boolean;
  isLocked: boolean;
  // Hotkey labels for overlay tooltips
  hotkeyToggleTimer: string;
  hotkeyToggleOverlay: string;
  hotkeyToggleOverlayLock: string;
}

interface OverlayConfig {
  overlayOpacity: number;
  overlayScale: 'small' | 'medium' | 'large';
  overlayFontSize: 'small' | 'medium' | 'large';
  overlayShowTimer: boolean;
  overlayShowZone: boolean;
  overlayShowLastSplit: boolean;
  overlayShowBreakpoints: boolean;
  overlayBreakpointCount: number;
  overlayBgOpacity: number;
  overlayAccentColor: string;
  overlayAlwaysOnTop: boolean;
  overlayLocked: boolean;
}

interface HotkeyLabels {
  hotkeyToggleTimer: string;
  hotkeyToggleOverlay: string;
  hotkeyToggleOverlayLock: string;
}

function buildOverlayState(
  timer: TimerState,
  breakpoints: Breakpoint[],
  config: OverlayConfig,
  personalBests: Map<string, number>,
  goldSplits: Map<string, number>,
  currentRun: { category: string; class: string } | null,
  hotkeyLabels: HotkeyLabels,
): OverlayState {
  const lastTimerSplit = timer.splits[timer.splits.length - 1] || null;
  const enabledBreakpoints = breakpoints.filter((bp: Breakpoint) => bp.isEnabled);
  const hitCount = timer.currentSplit;
  const category = currentRun ? `${currentRun.category}-${currentRun.class}` : null;
  const upcomingBreakpoints = enabledBreakpoints
    .slice(hitCount)
    .map((bp: Breakpoint, idx: number) => {
      const pbTimeMs = category ? (personalBests.get(`${category}-${bp.name}`) ?? null) : null;
      // Compute PB segment time: this BP's PB - previous BP's PB
      let pbSegmentTimeMs: number | null = null;
      if (pbTimeMs != null) {
        // Previous BP is either the last hit split or the previous upcoming
        const prevBpIndex = hitCount + idx - 1;
        if (prevBpIndex >= 0 && prevBpIndex < enabledBreakpoints.length) {
          const prevPbTime = category
            ? (personalBests.get(`${category}-${enabledBreakpoints[prevBpIndex].name}`) ?? null)
            : null;
          if (prevPbTime != null) {
            pbSegmentTimeMs = pbTimeMs - prevPbTime;
          }
        } else {
          // First breakpoint - segment = full PB time
          pbSegmentTimeMs = pbTimeMs;
        }
      }
      return { name: bp.name, pbTimeMs, pbSegmentTimeMs };
    });

  // Look up PB and gold segment times for the last split
  let pbSegmentTimeMs: number | null = null;
  let goldSegmentTimeMs: number | null = null;
  if (lastTimerSplit && currentRun) {
    const category = `${currentRun.category}-${currentRun.class}`;
    const pbSplitTime = personalBests.get(`${category}-${lastTimerSplit.name}`);
    const prevSplit = timer.splits.length >= 2 ? timer.splits[timer.splits.length - 2] : null;
    // PB segment = PB cumulative at this split - PB cumulative at previous split
    // Since we only store cumulative PBs, we approximate by looking up previous split PB
    if (pbSplitTime !== undefined && prevSplit) {
      const prevPbTime = personalBests.get(`${category}-${prevSplit.name}`);
      if (prevPbTime !== undefined) {
        pbSegmentTimeMs = pbSplitTime - prevPbTime;
      }
    } else if (pbSplitTime !== undefined) {
      // First split - PB segment = PB cumulative
      pbSegmentTimeMs = pbSplitTime;
    }
    const goldTime = goldSplits.get(`${category}-${lastTimerSplit.name}`);
    if (goldTime !== undefined) {
      goldSegmentTimeMs = goldTime;
    }
  }

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
          splitTimeMs: lastTimerSplit.splitTimeMs,
          segmentTimeMs: lastTimerSplit.segmentTimeMs,
          pbSegmentTimeMs,
          goldSegmentTimeMs,
        }
      : null,
    upcomingBreakpoints,
    opacity: config.overlayOpacity,
    scale: config.overlayScale,
    fontSize: config.overlayFontSize,
    showTimer: config.overlayShowTimer,
    showZone: config.overlayShowZone,
    showLastSplit: config.overlayShowLastSplit,
    showBreakpoints: config.overlayShowBreakpoints,
    breakpointCount: config.overlayBreakpointCount,
    bgOpacity: config.overlayBgOpacity,
    accentColor: config.overlayAccentColor,
    alwaysOnTop: config.overlayAlwaysOnTop,
    isLocked: config.overlayLocked,
    hotkeyToggleTimer: hotkeyLabels.hotkeyToggleTimer,
    hotkeyToggleOverlay: hotkeyLabels.hotkeyToggleOverlay,
    hotkeyToggleOverlayLock: hotkeyLabels.hotkeyToggleOverlayLock,
  };
}

function sendToOverlay(state: OverlayState) {
  invoke('sync_overlay_state', { state }).catch(() => {
    // Silently ignore - overlay might not be open
  });
}

export function useOverlaySync() {
  const timer = useRunStore((state: { timer: TimerState }) => state.timer);
  const personalBests = useRunStore((state) => state.personalBests);
  const goldSplits = useRunStore((state) => state.goldSplits);
  const currentRun = useRunStore((state) => state.currentRun);
  const breakpoints = useSettingsStore((state: { breakpoints: Breakpoint[] }) => state.breakpoints);
  const overlayOpacity = useSettingsStore((state) => state.overlayOpacity);
  const overlayScale = useSettingsStore((state) => state.overlayScale);
  const overlayFontSize = useSettingsStore((state) => state.overlayFontSize);
  const overlayShowTimer = useSettingsStore((state) => state.overlayShowTimer);
  const overlayShowZone = useSettingsStore((state) => state.overlayShowZone);
  const overlayShowLastSplit = useSettingsStore((state) => state.overlayShowLastSplit);
  const overlayShowBreakpoints = useSettingsStore((state) => state.overlayShowBreakpoints);
  const overlayBreakpointCount = useSettingsStore((state) => state.overlayBreakpointCount);
  const overlayBgOpacity = useSettingsStore((state) => state.overlayBgOpacity);
  const overlayAccentColor = useSettingsStore((state) => state.overlayAccentColor);
  const overlayAlwaysOnTop = useSettingsStore((state) => state.overlayAlwaysOnTop);
  const overlayLocked = useSettingsStore((state) => state.overlayLocked);
  const hotkeys = useSettingsStore((state) => state.hotkeys);

  const config: OverlayConfig = {
    overlayOpacity,
    overlayScale,
    overlayFontSize,
    overlayShowTimer,
    overlayShowZone,
    overlayShowLastSplit,
    overlayShowBreakpoints,
    overlayBreakpointCount,
    overlayBgOpacity,
    overlayAccentColor,
    overlayAlwaysOnTop,
    overlayLocked,
  };

  // Track previous non-time state to detect meaningful changes
  const prevNonTimeRef = useRef<string>('');

  const hotkeyLabels: HotkeyLabels = {
    hotkeyToggleTimer: hotkeys.toggleTimer,
    hotkeyToggleOverlay: hotkeys.toggleOverlay,
    hotkeyToggleOverlayLock: hotkeys.toggleOverlayLock,
  };

  // Build and send current state
  const syncNow = useCallback(() => {
    const runInfo = currentRun ? { category: currentRun.category, class: currentRun.class } : null;
    const state = buildOverlayState(timer, breakpoints, config, personalBests, goldSplits, runInfo, hotkeyLabels);
    sendToOverlay(state);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, breakpoints, overlayOpacity, overlayScale, overlayFontSize, overlayShowTimer, overlayShowZone, overlayShowLastSplit, overlayShowBreakpoints, overlayBreakpointCount, overlayBgOpacity, overlayAccentColor, overlayAlwaysOnTop, overlayLocked, personalBests, goldSplits, currentRun, hotkeys]);

  // Emit immediately on meaningful state changes (zone, splits, start/stop, config, etc.)
  useEffect(() => {
    const nonTimeKey = JSON.stringify({
      startTime: timer.startTime,
      isRunning: timer.isRunning,
      currentZone: timer.currentZone,
      currentSplit: timer.currentSplit,
      splitCount: timer.splits.length,
      lastSplitName: timer.splits[timer.splits.length - 1]?.name,
      opacity: overlayOpacity,
      scale: overlayScale,
      fontSize: overlayFontSize,
      showTimer: overlayShowTimer,
      showZone: overlayShowZone,
      showLastSplit: overlayShowLastSplit,
      showBreakpoints: overlayShowBreakpoints,
      breakpointCount: overlayBreakpointCount,
      bgOpacity: overlayBgOpacity,
      accentColor: overlayAccentColor,
      alwaysOnTop: overlayAlwaysOnTop,
      locked: overlayLocked,
    });

    if (nonTimeKey !== prevNonTimeRef.current) {
      prevNonTimeRef.current = nonTimeKey;
      syncNow();
    }
  }, [timer, overlayOpacity, overlayScale, overlayFontSize, overlayShowTimer, overlayShowZone, overlayShowLastSplit, overlayShowBreakpoints, overlayBreakpointCount, overlayBgOpacity, overlayAccentColor, overlayAlwaysOnTop, overlayLocked, syncNow]);

  // Listen for overlay-ready signal and immediately sync
  useEffect(() => {
    const unlistenReady = listen('overlay-ready', () => {
      syncNow();
    });

    return () => {
      unlistenReady.then((fn) => fn());
    };
  }, [syncNow]);

  // Periodic heartbeat so overlay stays in sync even if it opens late
  useEffect(() => {
    const interval = setInterval(() => {
      syncNow();
    }, 2000);

    return () => clearInterval(interval);
  }, [syncNow]);
}
