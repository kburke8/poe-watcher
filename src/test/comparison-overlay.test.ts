import { describe, it, expect } from 'vitest';
import type { TimerState, Breakpoint } from '../types';

// Extract and test the buildOverlayState logic
// We replicate it here since it's not exported from the hook module

// Replicated from useOverlaySync.ts for unit testing
function buildTestOverlayState(
  timer: TimerState,
  breakpoints: Breakpoint[],
  personalBests: Map<string, number>,
  goldSplits: Map<string, number>,
  comparisonSplits: Map<string, number>,
  currentRun: { category: string; class: string } | null,
  fallbackCategory: string | null,
) {
  const lastTimerSplit = timer.splits[timer.splits.length - 1] || null;
  const enabledBreakpoints = breakpoints.filter((bp) => bp.isEnabled);
  const hitCount = timer.currentSplit;
  const category = currentRun?.category ?? fallbackCategory;
  const cls = currentRun?.class ?? 'Unknown';
  const hasComparison = comparisonSplits.size > 0;

  const getRefTime = (bpName: string): number | null => {
    const compTime = hasComparison ? (comparisonSplits.get(bpName) ?? null) : null;
    const pbTime = category ? (personalBests.get(`${category}-${cls}-${bpName}`) ?? null) : null;
    return compTime ?? pbTime;
  };

  const upcomingBreakpoints = enabledBreakpoints
    .slice(hitCount)
    .map((bp, idx) => {
      const refTimeMs = getRefTime(bp.name);
      let pbSegmentTimeMs: number | null = null;
      if (refTimeMs != null) {
        const prevBpIndex = hitCount + idx - 1;
        if (prevBpIndex >= 0 && prevBpIndex < enabledBreakpoints.length) {
          const prevRefTime = getRefTime(enabledBreakpoints[prevBpIndex].name);
          if (prevRefTime != null) {
            pbSegmentTimeMs = refTimeMs - prevRefTime;
          }
        } else {
          pbSegmentTimeMs = refTimeMs;
        }
      }
      return { name: bp.name, pbTimeMs: refTimeMs, pbSegmentTimeMs };
    });

  // Last split reference and gold segment times
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
      pbSegmentTimeMs = refSplitTime;
    }
    if (category) {
      const goldTime = goldSplits.get(`${category}-${cls}-${lastTimerSplit.name}`);
      if (goldTime !== undefined) {
        goldSegmentTimeMs = goldTime;
      }
    }
  }

  return {
    upcomingBreakpoints,
    lastSplitPbSegmentTimeMs: pbSegmentTimeMs,
    lastSplitGoldSegmentTimeMs: goldSegmentTimeMs,
  };
}

// Helper to create a breakpoint
function bp(name: string, enabled = true): Breakpoint {
  return {
    name,
    type: 'zone',
    trigger: { type: 'zone', zoneName: name, act: 1 },
    isEnabled: enabled,
    captureSnapshot: false,
  };
}

const baseTimer: TimerState = {
  isRunning: true,
  startTime: Date.now() - 100_000,
  elapsedMs: 100_000,
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
  isInEndgame: false,
  act10FinalTimeMs: null,
  mapCount: 0,
  currentMapEnteredAt: null,
  currentMapElapsedMs: 0,
  currentMapZone: null,
  currentMapAreaLevel: null,
  currentMapSeed: null,
  latestSeed: null,
  latestAreaLevel: null,
  endgameTownTimeMs: 0,
  endgameDeathCount: 0,
  isMappingSession: false,
  completedMaps: [],
};

describe('buildOverlayState - comparison integration', () => {
  const breakpoints = [bp('The Coast'), bp('Mud Flats'), bp('Brutus'), bp('Act 2')];

  it('uses PB times when no comparison is active', () => {
    const pbs = new Map([
      ['Act 10 Any%-Witch-The Coast', 60_000],
      ['Act 10 Any%-Witch-Mud Flats', 120_000],
      ['Act 10 Any%-Witch-Brutus', 200_000],
    ]);

    const result = buildTestOverlayState(
      baseTimer,
      breakpoints,
      pbs,
      new Map(),
      new Map(),  // no comparison
      { category: 'Act 10 Any%', class: 'Witch' },
      null,
    );

    expect(result.upcomingBreakpoints).toHaveLength(4);
    expect(result.upcomingBreakpoints[0]).toEqual({
      name: 'The Coast',
      pbTimeMs: 60_000,
      pbSegmentTimeMs: 60_000, // first BP: segment = full time
    });
    expect(result.upcomingBreakpoints[1]).toEqual({
      name: 'Mud Flats',
      pbTimeMs: 120_000,
      pbSegmentTimeMs: 60_000, // 120k - 60k
    });
    expect(result.upcomingBreakpoints[2]).toEqual({
      name: 'Brutus',
      pbTimeMs: 200_000,
      pbSegmentTimeMs: 80_000, // 200k - 120k
    });
    expect(result.upcomingBreakpoints[3]).toEqual({
      name: 'Act 2',
      pbTimeMs: null,
      pbSegmentTimeMs: null, // no PB
    });
  });

  it('uses comparison times when active, overriding PB', () => {
    const pbs = new Map([
      ['Act 10 Any%-Witch-The Coast', 60_000],
      ['Act 10 Any%-Witch-Mud Flats', 120_000],
    ]);
    const comparison = new Map([
      ['The Coast', 50_000],
      ['Mud Flats', 100_000],
      ['Brutus', 170_000],
    ]);

    const result = buildTestOverlayState(
      baseTimer,
      breakpoints,
      pbs,
      new Map(),
      comparison,
      { category: 'Act 10 Any%', class: 'Witch' },
      null,
    );

    // Comparison takes precedence
    expect(result.upcomingBreakpoints[0].pbTimeMs).toBe(50_000);
    expect(result.upcomingBreakpoints[1].pbTimeMs).toBe(100_000);
    expect(result.upcomingBreakpoints[2].pbTimeMs).toBe(170_000);
    // Act 2 has neither comparison nor PB
    expect(result.upcomingBreakpoints[3].pbTimeMs).toBeNull();
  });

  it('falls back to PB when comparison has partial data', () => {
    const pbs = new Map([
      ['Act 10 Any%-Witch-The Coast', 60_000],
      ['Act 10 Any%-Witch-Mud Flats', 120_000],
      ['Act 10 Any%-Witch-Act 2', 350_000],
    ]);
    const comparison = new Map([
      ['The Coast', 50_000],
      // Mud Flats missing from comparison
      ['Brutus', 170_000],
    ]);

    const result = buildTestOverlayState(
      baseTimer,
      breakpoints,
      pbs,
      new Map(),
      comparison,
      { category: 'Act 10 Any%', class: 'Witch' },
      null,
    );

    expect(result.upcomingBreakpoints[0].pbTimeMs).toBe(50_000);  // comparison
    expect(result.upcomingBreakpoints[1].pbTimeMs).toBe(120_000); // PB fallback
    expect(result.upcomingBreakpoints[2].pbTimeMs).toBe(170_000); // comparison
    expect(result.upcomingBreakpoints[3].pbTimeMs).toBe(350_000); // PB fallback
  });

  it('computes segment times correctly with comparison', () => {
    const comparison = new Map([
      ['The Coast', 50_000],
      ['Mud Flats', 110_000],
      ['Brutus', 190_000],
      ['Act 2', 350_000],
    ]);

    const result = buildTestOverlayState(
      baseTimer,
      breakpoints,
      new Map(),
      new Map(),
      comparison,
      { category: 'Act 10 Any%', class: 'Witch' },
      null,
    );

    expect(result.upcomingBreakpoints[0].pbSegmentTimeMs).toBe(50_000);  // first: full time
    expect(result.upcomingBreakpoints[1].pbSegmentTimeMs).toBe(60_000);  // 110k - 50k
    expect(result.upcomingBreakpoints[2].pbSegmentTimeMs).toBe(80_000);  // 190k - 110k
    expect(result.upcomingBreakpoints[3].pbSegmentTimeMs).toBe(160_000); // 350k - 190k
  });

  it('handles last split reference time with comparison', () => {
    const timer: TimerState = {
      ...baseTimer,
      currentSplit: 2,
      splits: [
        { name: 'The Coast', splitTimeMs: 55_000, segmentTimeMs: 55_000, deltaMs: 5_000, isBestSegment: false },
        { name: 'Mud Flats', splitTimeMs: 115_000, segmentTimeMs: 60_000, deltaMs: 5_000, isBestSegment: false },
      ],
    };

    const comparison = new Map([
      ['The Coast', 50_000],
      ['Mud Flats', 100_000],
      ['Brutus', 170_000],
    ]);

    const result = buildTestOverlayState(
      timer,
      breakpoints,
      new Map(),
      new Map(),
      comparison,
      { category: 'Act 10 Any%', class: 'Witch' },
      null,
    );

    // Last split (Mud Flats) reference segment: 100k - 50k = 50k
    expect(result.lastSplitPbSegmentTimeMs).toBe(50_000);
    // Remaining upcoming should start from index 2
    expect(result.upcomingBreakpoints).toHaveLength(2);
    expect(result.upcomingBreakpoints[0].name).toBe('Brutus');
  });

  it('handles first split as last split (no previous)', () => {
    const timer: TimerState = {
      ...baseTimer,
      currentSplit: 1,
      splits: [
        { name: 'The Coast', splitTimeMs: 55_000, segmentTimeMs: 55_000, deltaMs: 5_000, isBestSegment: false },
      ],
    };

    const comparison = new Map([
      ['The Coast', 50_000],
    ]);

    const result = buildTestOverlayState(
      timer,
      breakpoints,
      new Map(),
      new Map(),
      comparison,
      { category: 'Act 10 Any%', class: 'Witch' },
      null,
    );

    // First split - segment = cumulative = 50k
    expect(result.lastSplitPbSegmentTimeMs).toBe(50_000);
  });

  it('uses fallback category when no current run', () => {
    const pbs = new Map([
      ['Act 5 Any%-Unknown-The Coast', 60_000],
    ]);

    const result = buildTestOverlayState(
      baseTimer,
      breakpoints,
      pbs,
      new Map(),
      new Map(),
      null,  // no current run
      'Act 5 Any%',  // fallback
    );

    expect(result.upcomingBreakpoints[0].pbTimeMs).toBe(60_000);
  });

  it('skips disabled breakpoints', () => {
    const bps = [bp('The Coast'), bp('Mud Flats', false), bp('Brutus')];
    const comparison = new Map([
      ['The Coast', 50_000],
      ['Brutus', 170_000],
    ]);

    const result = buildTestOverlayState(
      baseTimer,
      bps,
      new Map(),
      new Map(),
      comparison,
      { category: 'Act 10 Any%', class: 'Witch' },
      null,
    );

    expect(result.upcomingBreakpoints).toHaveLength(2);
    expect(result.upcomingBreakpoints.map(b => b.name)).toEqual(['The Coast', 'Brutus']);
  });

  it('returns null gold segment time when no gold split exists', () => {
    const timer: TimerState = {
      ...baseTimer,
      currentSplit: 1,
      splits: [
        { name: 'The Coast', splitTimeMs: 55_000, segmentTimeMs: 55_000, deltaMs: null, isBestSegment: true },
      ],
    };

    const result = buildTestOverlayState(
      timer,
      breakpoints,
      new Map(),
      new Map(),  // no gold splits
      new Map(),
      { category: 'Act 10 Any%', class: 'Witch' },
      null,
    );

    expect(result.lastSplitGoldSegmentTimeMs).toBeNull();
  });

  it('returns gold segment time when gold split exists', () => {
    const timer: TimerState = {
      ...baseTimer,
      currentSplit: 1,
      splits: [
        { name: 'The Coast', splitTimeMs: 55_000, segmentTimeMs: 55_000, deltaMs: null, isBestSegment: false },
      ],
    };

    const golds = new Map([
      ['Act 10 Any%-Witch-The Coast', 45_000],
    ]);

    const result = buildTestOverlayState(
      timer,
      breakpoints,
      new Map(),
      golds,
      new Map(),
      { category: 'Act 10 Any%', class: 'Witch' },
      null,
    );

    expect(result.lastSplitGoldSegmentTimeMs).toBe(45_000);
  });
});
