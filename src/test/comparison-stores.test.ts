import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useRunStore } from '../stores/runStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { Split } from '../types';

// Type the mock
const mockInvoke = vi.mocked(invoke);

describe('settingsStore - comparison state', () => {
  beforeEach(() => {
    // Reset stores between tests
    useSettingsStore.setState({
      activeComparisonRunId: null,
      activeComparisonLabel: null,
    });
  });

  it('initializes with null comparison', () => {
    const state = useSettingsStore.getState();
    expect(state.activeComparisonRunId).toBeNull();
    expect(state.activeComparisonLabel).toBeNull();
  });

  it('sets active comparison with label', () => {
    useSettingsStore.getState().setActiveComparison(42, 'WR Run');

    const state = useSettingsStore.getState();
    expect(state.activeComparisonRunId).toBe(42);
    expect(state.activeComparisonLabel).toBe('WR Run');
  });

  it('clears active comparison', () => {
    useSettingsStore.getState().setActiveComparison(42, 'WR Run');
    useSettingsStore.getState().setActiveComparison(null, null);

    const state = useSettingsStore.getState();
    expect(state.activeComparisonRunId).toBeNull();
    expect(state.activeComparisonLabel).toBeNull();
  });

  it('sets comparison with default null label', () => {
    useSettingsStore.getState().setActiveComparison(99);

    const state = useSettingsStore.getState();
    expect(state.activeComparisonRunId).toBe(99);
    expect(state.activeComparisonLabel).toBeNull();
  });

  it('overwrites previous comparison', () => {
    useSettingsStore.getState().setActiveComparison(1, 'First');
    useSettingsStore.getState().setActiveComparison(2, 'Second');

    const state = useSettingsStore.getState();
    expect(state.activeComparisonRunId).toBe(2);
    expect(state.activeComparisonLabel).toBe('Second');
  });
});

describe('runStore - comparison splits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRunStore.setState({
      comparisonSplits: new Map(),
      personalBests: new Map(),
      goldSplits: new Map(),
      currentRun: null,
      splits: [],
      timer: {
        isRunning: false,
        startTime: null,
        elapsedMs: 0,
        currentSplit: 0,
        splits: [],
        townTimeMs: 0,
        hideoutTimeMs: 0,
        inTown: false,
        inHideout: false,
        townEnteredAt: null,
        hideoutEnteredAt: null,
        currentZone: null,
        deathCount: 0,
        townVisits: [],
        activeBossEncounter: null,
        bossEncounters: [],
      },
    });
  });

  it('initializes with empty comparison splits', () => {
    const state = useRunStore.getState();
    expect(state.comparisonSplits.size).toBe(0);
  });

  it('loads comparison splits from a run', async () => {
    const mockSplits: Split[] = [
      { id: 1, runId: 10, breakpointType: 'zone', breakpointName: 'The Coast', splitTimeMs: 60_000, deltaMs: null, segmentTimeMs: 60_000, townTimeMs: 0, hideoutTimeMs: 0, deathCount: 0, bossFightMs: 0 },
      { id: 2, runId: 10, breakpointType: 'boss', breakpointName: 'Brutus', splitTimeMs: 120_000, deltaMs: null, segmentTimeMs: 60_000, townTimeMs: 0, hideoutTimeMs: 0, deathCount: 0, bossFightMs: 0 },
      { id: 3, runId: 10, breakpointType: 'act', breakpointName: 'Act 2', splitTimeMs: 300_000, deltaMs: null, segmentTimeMs: 180_000, townTimeMs: 0, hideoutTimeMs: 0, deathCount: 0, bossFightMs: 0 },
    ];

    mockInvoke.mockResolvedValueOnce(mockSplits);

    await useRunStore.getState().loadComparisonSplits(10);

    const state = useRunStore.getState();
    expect(state.comparisonSplits.size).toBe(3);
    expect(state.comparisonSplits.get('The Coast')).toBe(60_000);
    expect(state.comparisonSplits.get('Brutus')).toBe(120_000);
    expect(state.comparisonSplits.get('Act 2')).toBe(300_000);
    expect(mockInvoke).toHaveBeenCalledWith('get_splits', { runId: 10 });
  });

  it('clears comparison splits on error', async () => {
    // Pre-populate
    useRunStore.setState({
      comparisonSplits: new Map([['foo', 100]]),
    });

    mockInvoke.mockRejectedValueOnce(new Error('DB error'));

    await useRunStore.getState().loadComparisonSplits(999);

    const state = useRunStore.getState();
    expect(state.comparisonSplits.size).toBe(0);
  });

  it('clears comparison splits explicitly', () => {
    useRunStore.setState({
      comparisonSplits: new Map([['foo', 100], ['bar', 200]]),
    });

    useRunStore.getState().clearComparisonSplits();
    expect(useRunStore.getState().comparisonSplits.size).toBe(0);
  });
});

describe('runStore - addSplit with comparison precedence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRunStore.setState({
      currentRun: {
        id: 1,
        category: 'Act 10 Any%',
        class: 'Witch',
        character: 'TestChar',
        startedAt: new Date().toISOString(),
        isCompleted: false,
        isPersonalBest: false,
        status: 'in_progress',
        endedAt: null,
        totalTimeMs: null,
      },
      splits: [],
      timer: {
        isRunning: true,
        startTime: Date.now() - 60_000,
        elapsedMs: 60_000,
        currentSplit: 0,
        splits: [],
        townTimeMs: 0,
        hideoutTimeMs: 0,
        inTown: false,
        inHideout: false,
        townEnteredAt: null,
        hideoutEnteredAt: null,
        currentZone: 'The Coast',
        deathCount: 0,
        townVisits: [],
        activeBossEncounter: null,
        bossEncounters: [],
      },
      personalBests: new Map([
        ['Act 10 Any%-Witch-The Coast', 50_000],
      ]),
      goldSplits: new Map([
        ['Act 10 Any%-Witch-The Coast', 45_000],
      ]),
      comparisonSplits: new Map(),
    });
  });

  it('uses PB when no comparison is active', () => {
    useRunStore.getState().addSplit({
      breakpointType: 'zone',
      breakpointName: 'The Coast',
      splitTimeMs: 55_000,
      deltaMs: null,
      segmentTimeMs: 55_000,
      townTimeMs: 0,
      hideoutTimeMs: 0,
      deathCount: 0,
      bossFightMs: 0,
    });

    const state = useRunStore.getState();
    const lastSplit = state.splits[state.splits.length - 1];
    // delta = 55000 - 50000 (PB) = 5000
    expect(lastSplit.deltaMs).toBe(5_000);
  });

  it('uses comparison when both comparison and PB exist', () => {
    // Set comparison splits
    useRunStore.setState({
      comparisonSplits: new Map([
        ['The Coast', 40_000],
      ]),
    });

    useRunStore.getState().addSplit({
      breakpointType: 'zone',
      breakpointName: 'The Coast',
      splitTimeMs: 55_000,
      deltaMs: null,
      segmentTimeMs: 55_000,
      townTimeMs: 0,
      hideoutTimeMs: 0,
      deathCount: 0,
      bossFightMs: 0,
    });

    const state = useRunStore.getState();
    const lastSplit = state.splits[state.splits.length - 1];
    // delta = 55000 - 40000 (comparison, not PB 50000) = 15000
    expect(lastSplit.deltaMs).toBe(15_000);
  });

  it('falls back to PB when comparison has no matching split', () => {
    // Comparison exists but doesn't have this breakpoint
    useRunStore.setState({
      comparisonSplits: new Map([
        ['Brutus', 90_000],
      ]),
    });

    useRunStore.getState().addSplit({
      breakpointType: 'zone',
      breakpointName: 'The Coast',
      splitTimeMs: 55_000,
      deltaMs: null,
      segmentTimeMs: 55_000,
      townTimeMs: 0,
      hideoutTimeMs: 0,
      deathCount: 0,
      bossFightMs: 0,
    });

    const state = useRunStore.getState();
    const lastSplit = state.splits[state.splits.length - 1];
    // Should use PB since comparison doesn't have this split
    expect(lastSplit.deltaMs).toBe(5_000);
  });

  it('returns null delta when no reference exists', () => {
    useRunStore.setState({
      personalBests: new Map(),
      comparisonSplits: new Map(),
    });

    useRunStore.getState().addSplit({
      breakpointType: 'zone',
      breakpointName: 'Unknown Zone',
      splitTimeMs: 55_000,
      deltaMs: null,
      segmentTimeMs: 55_000,
      townTimeMs: 0,
      hideoutTimeMs: 0,
      deathCount: 0,
      bossFightMs: 0,
    });

    const state = useRunStore.getState();
    const lastSplit = state.splits[state.splits.length - 1];
    expect(lastSplit.deltaMs).toBeNull();
  });

  it('correctly calculates negative delta (ahead of comparison)', () => {
    useRunStore.setState({
      comparisonSplits: new Map([
        ['The Coast', 70_000],
      ]),
    });

    useRunStore.getState().addSplit({
      breakpointType: 'zone',
      breakpointName: 'The Coast',
      splitTimeMs: 55_000,
      deltaMs: null,
      segmentTimeMs: 55_000,
      townTimeMs: 0,
      hideoutTimeMs: 0,
      deathCount: 0,
      bossFightMs: 0,
    });

    const state = useRunStore.getState();
    const lastSplit = state.splits[state.splits.length - 1];
    // delta = 55000 - 70000 = -15000 (ahead!)
    expect(lastSplit.deltaMs).toBe(-15_000);
  });
});
