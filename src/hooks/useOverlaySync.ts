import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useRunStore } from '../stores/runStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getWizardCategory } from '../config/wizardRoutes';
import type { TimerState, Breakpoint } from '../types';

interface EndgameState {
  act10FinalTimeMs: number | null;
  isMappingSession?: boolean;
  townHideoutTimeMs: number;
  deathCount: number;
  mapCount: number;
  currentMapStartTime: number | null;
  currentMapElapsedMs: number;
  currentMapZone: string | null;
}

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
  // Hotkey labels for overlay tooltips
  hotkeyToggleTimer: string;
  hotkeyToggleOverlay: string;
  // Endgame mode
  isEndgame: boolean;
  endgame: EndgameState | null;
  // Transparency mode
  transparent: boolean;
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
  overlayTransparent: boolean;
}

interface HotkeyLabels {
  hotkeyToggleTimer: string;
  hotkeyToggleOverlay: string;
}

function buildOverlayState(
  timer: TimerState,
  breakpoints: Breakpoint[],
  config: OverlayConfig,
  personalBests: Map<string, number>,
  goldSplits: Map<string, number>,
  comparisonSplits: Map<string, number>,
  currentRun: { category: string; class: string } | null,
  hotkeyLabels: HotkeyLabels,
  fallbackCategory: string | null,
): OverlayState {
  const lastTimerSplit = timer.splits[timer.splits.length - 1] || null;
  const enabledBreakpoints = breakpoints.filter((bp: Breakpoint) => bp.isEnabled);
  const hitCount = timer.currentSplit;
  const category = currentRun?.category ?? fallbackCategory;
  const cls = currentRun?.class ?? 'Unknown';
  const hasComparison = comparisonSplits.size > 0;

  if (import.meta.env.DEV) {
    console.log('[OverlaySync] category:', category, '| class:', cls, '| PB entries:', personalBests.size, '| gold entries:', goldSplits.size, '| comparison entries:', comparisonSplits.size);
    if (personalBests.size > 0) {
      console.log('[OverlaySync] PB keys:', [...personalBests.keys()]);
    }
  }

  // Helper to get reference time for a breakpoint (comparison > PB)
  const getRefTime = (bpName: string): number | null => {
    const compTime = hasComparison ? (comparisonSplits.get(bpName) ?? null) : null;
    const pbTime = category ? (personalBests.get(`${category}-${cls}-${bpName}`) ?? null) : null;
    return compTime ?? pbTime;
  };

  const upcomingBreakpoints = enabledBreakpoints
    .slice(hitCount)
    .map((bp: Breakpoint, idx: number) => {
      const refTimeMs = getRefTime(bp.name);
      // Compute segment time: this BP's ref - previous BP's ref
      let pbSegmentTimeMs: number | null = null;
      if (refTimeMs != null) {
        const prevBpIndex = hitCount + idx - 1;
        if (prevBpIndex >= 0 && prevBpIndex < enabledBreakpoints.length) {
          const prevRefTime = getRefTime(enabledBreakpoints[prevBpIndex].name);
          if (prevRefTime != null) {
            pbSegmentTimeMs = refTimeMs - prevRefTime;
          }
        } else {
          // First breakpoint - segment = full ref time
          pbSegmentTimeMs = refTimeMs;
        }
      }
      return { name: bp.name, pbTimeMs: refTimeMs, pbSegmentTimeMs };
    });

  // Look up reference and gold segment times for the last split
  let pbSegmentTimeMs: number | null = null;
  let goldSegmentTimeMs: number | null = null;
  if (lastTimerSplit) {
    const refSplitTime = getRefTime(lastTimerSplit.name);
    const prevSplit = timer.splits.length >= 2 ? timer.splits[timer.splits.length - 2] : null;
    if (refSplitTime != null && prevSplit) {
      const prevRefTime = getRefTime(prevSplit.name);
      if (prevRefTime != null) {
        pbSegmentTimeMs = refSplitTime - prevRefTime;
      }
    } else if (refSplitTime != null) {
      // First split - segment = cumulative
      pbSegmentTimeMs = refSplitTime;
    }
    if (category) {
      const goldTime = goldSplits.get(`${category}-${cls}-${lastTimerSplit.name}`);
      if (goldTime !== undefined) {
        goldSegmentTimeMs = goldTime;
      }
    }
  }

  // Compute endgame state
  let endgame: EndgameState | null = null;
  if (timer.isInEndgame) {
    // Compute live town/hideout time (flush pending)
    let townHideoutTimeMs = timer.endgameTownTimeMs;
    const now = Date.now();
    if (timer.inTown && timer.townEnteredAt !== null) {
      townHideoutTimeMs += now - timer.townEnteredAt;
    }
    if (timer.inHideout && timer.hideoutEnteredAt !== null) {
      townHideoutTimeMs += now - timer.hideoutEnteredAt;
    }

    endgame = {
      act10FinalTimeMs: timer.act10FinalTimeMs,
      isMappingSession: timer.isMappingSession,
      townHideoutTimeMs,
      deathCount: timer.endgameDeathCount,
      mapCount: timer.mapCount,
      currentMapStartTime: timer.currentMapEnteredAt,
      currentMapElapsedMs: timer.currentMapElapsedMs,
      currentMapZone: timer.currentMapZone,
    };
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
    hotkeyToggleTimer: hotkeyLabels.hotkeyToggleTimer,
    hotkeyToggleOverlay: hotkeyLabels.hotkeyToggleOverlay,
    isEndgame: timer.isInEndgame,
    endgame,
    transparent: config.overlayTransparent,
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
  const comparisonSplits = useRunStore((state) => state.comparisonSplits);
  const currentRun = useRunStore((state) => state.currentRun);
  const breakpoints = useSettingsStore((state: { breakpoints: Breakpoint[] }) => state.breakpoints);
  const wizardConfig = useSettingsStore((state) => state.wizardConfig);
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
  const overlayTransparent = useSettingsStore((state) => state.overlayTransparent);
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
    overlayTransparent,
  };

  // Track previous non-time state to detect meaningful changes
  const prevNonTimeRef = useRef<string>('');

  const hotkeyLabels: HotkeyLabels = {
    hotkeyToggleTimer: hotkeys.toggleTimer,
    hotkeyToggleOverlay: hotkeys.toggleOverlay,
  };

  // Build and send current state
  const syncNow = useCallback(() => {
    const runInfo = currentRun ? { category: currentRun.category, class: currentRun.class } : null;
    const fallbackCategory = wizardConfig ? getWizardCategory(wizardConfig) : null;
    const state = buildOverlayState(timer, breakpoints, config, personalBests, goldSplits, comparisonSplits, runInfo, hotkeyLabels, fallbackCategory);
    sendToOverlay(state);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, breakpoints, overlayOpacity, overlayScale, overlayFontSize, overlayShowTimer, overlayShowZone, overlayShowLastSplit, overlayShowBreakpoints, overlayBreakpointCount, overlayBgOpacity, overlayAccentColor, overlayAlwaysOnTop, overlayTransparent, personalBests, goldSplits, comparisonSplits, currentRun, hotkeys, wizardConfig]);

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
      pbCount: personalBests.size,
      goldCount: goldSplits.size,
      comparisonCount: comparisonSplits.size,
      // Endgame
      isEndgame: timer.isInEndgame,
      mapCount: timer.mapCount,
      endgameDeathCount: timer.endgameDeathCount,
      currentMapZone: timer.currentMapZone,
      // Transparency
      transparent: overlayTransparent,
    });

    if (nonTimeKey !== prevNonTimeRef.current) {
      prevNonTimeRef.current = nonTimeKey;
      syncNow();
    }
  }, [timer, overlayOpacity, overlayScale, overlayFontSize, overlayShowTimer, overlayShowZone, overlayShowLastSplit, overlayShowBreakpoints, overlayBreakpointCount, overlayBgOpacity, overlayAccentColor, overlayAlwaysOnTop, overlayTransparent, personalBests, goldSplits, comparisonSplits, syncNow]);

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
