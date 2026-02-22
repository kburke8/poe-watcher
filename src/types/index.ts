// Core types for PoE Watcher

export type RunStatus = 'completed' | 'abandoned' | 'in_progress';

export interface Run {
  id: number;
  character?: string;
  characterName?: string;
  accountName?: string;
  class: string;
  ascendancy?: string | null;
  league?: string;
  category: string;
  startedAt: string;
  endedAt: string | null;
  totalTimeMs: number | null;
  townTimeMs?: number;
  isCompleted: boolean;
  isPersonalBest: boolean;
  status: RunStatus;
  // Breakpoint tracking
  breakpointPreset?: string | null;
  enabledBreakpoints?: string[] | null;
  // Reference run support
  isReference?: boolean;
  sourceName?: string | null;
  // Group mode
  isGroupRun?: boolean;
}

export interface Split {
  id: number;
  runId: number;
  breakpointType: BreakpointType;
  breakpointName: string;
  splitTimeMs: number;
  deltaMs: number | null;
  segmentTimeMs: number;
  // Town/hideout time tracking (cumulative at this split)
  townTimeMs: number;
  hideoutTimeMs: number;
  // Death tracking (cumulative at this split)
  deathCount: number;
  // Boss fight time for this segment
  bossFightMs: number;
}

export type BreakpointType = 'zone' | 'level' | 'boss' | 'act' | 'lab' | 'custom';

export interface Snapshot {
  id: number;
  runId: number;
  splitId: number;
  timestamp: string;
  elapsedTimeMs: number;
  characterLevel: number;
  itemsJson: string;
  skillsJson: string;
  passiveTreeJson: string;
  statsJson: string;
  pobCode: string | null;
}

export interface PersonalBest {
  id: number;
  category: string;
  class: string;
  runId: number;
  totalTimeMs: number;
}

export interface GoldSplit {
  id: number;
  category: string;
  class: string;
  breakpointName: string;
  bestSegmentMs: number;
}

// Log events parsed from Client.txt
export interface LogEvent {
  timestamp: Date;
  type: LogEventType;
  data: LogEventData;
}

export type LogEventType =
  | 'zone_enter'
  | 'level_up'
  | 'death'
  | 'instance_details'
  | 'login'
  | 'kitava_affliction'
  | 'npc_dialog';

export interface ZoneEnterEvent {
  zoneName: string;
  act: number | null;
}

export interface LevelUpEvent {
  characterName: string;
  characterClass: string;
  level: number;
}

export interface DeathEvent {
  characterName: string;
}

export type LogEventData = ZoneEnterEvent | LevelUpEvent | DeathEvent | Record<string, never>;

// Breakpoint configuration
export interface Breakpoint {
  name: string;
  type: BreakpointType;
  trigger: BreakpointTrigger;
  isEnabled: boolean;
  captureSnapshot: boolean;
}

export interface BreakpointTrigger {
  type: 'zone' | 'level' | 'boss' | 'kitava';
  zoneName?: string;
  act?: number;
  level?: number;
  penalty?: number;
}

// Wizard configuration for guided breakpoint setup
export interface WizardConfig {
  endAct: 0 | 1 | 3 | 5 | 10;
  runType: 'any_percent' | 'hundred_percent';
  verbosity: 'every_zone' | 'key_zones' | 'bosses_only' | 'acts_only';
  snapshotFrequency: 'bosses_only' | 'acts_only';
  routes: {
    act1: 'standard' | 'early_dweller';
    act2: 'standard' | 'early_crypt';
    act4: 'standard' | 'kaom_first';
    act6SkipLily: boolean;
    act6AddTidal: boolean;
    act8: 'standard' | 'legacy';
    includeLabs: boolean;
    act10Lab3: 'before_torched_courts' | 'after_desecrated_chambers';
  };
}

// Settings
export interface Settings {
  poeLogPath: string;
  accountName: string;
  testCharacterName: string; // Fallback character name for testing when not detected from game
  checkUpdates: boolean;
  overlayEnabled: boolean;
  overlayOpacity: number;
  soundEnabled: boolean;
  breakpoints: Breakpoint[];
  wizardConfig?: WizardConfig;
  // Overlay display config
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
  // Group mode
  groupModeEnabled: boolean;
}

// PoE API types
export interface PoeCharacter {
  name: string;
  league: string;
  classId: number;
  ascendancyClass: number;
  class: string;
  level: number;
  experience: number;
}

export interface PoeItem {
  id: string;
  name: string;
  typeLine: string;
  icon?: string;
  inventoryId: string;
  socketedItems?: PoeItem[];
  sockets?: PoeSocket[];
  explicitMods?: string[];
  implicitMods?: string[];
  frameType: number;
  x?: number;
  y?: number;
  w: number;
  h: number;
  ilvl?: number;
  properties?: Array<{
    name: string;
    values?: Array<[string | number, number]>;
  }>;
}

export interface PoeSocket {
  group: number;
  attr: string;
}

export interface PoePassiveSkills {
  hashes: number[];
  jewelData?: Record<string, unknown>;
}

// Hotkey settings
export interface HotkeySettings {
  toggleTimer: string;
  resetTimer: string;
  manualSnapshot: string;
  manualSplit: string;
  toggleOverlay: string;
  toggleOverlayLock: string;
}

export const DEFAULT_HOTKEYS: HotkeySettings = {
  toggleTimer: 'Ctrl+Space',
  resetTimer: 'Ctrl+Shift+Space',
  manualSnapshot: 'Ctrl+Alt+Space',
  manualSplit: 'Ctrl+Shift+S',
  toggleOverlay: 'Ctrl+O',
  toggleOverlayLock: 'Ctrl+Shift+L',
};

// Town visit tracking (individual visits shown as pseudo-segments)
export interface TownVisit {
  zoneName: string;
  enteredAt: number;        // Date.now() timestamp
  exitedAt: number | null;  // null = still in town
  durationMs: number;       // computed on exit
  afterSplitIndex: number;  // timer.splits.length - 1 at time of entry
}

// Boss encounter tracking (detected via NPC dialog lines)
export interface BossEncounter {
  bossName: string;         // "Brutus" or "Merveil"
  zoneName: string;         // zone where encounter started (for re-entry detection)
  startedAt: number;        // Date.now() when dialog detected
  endedAt: number | null;
  durationMs: number | null;
  afterSplitIndex: number;  // timer.splits.length - 1 at time of start
}

// Timer state
export interface TimerState {
  isRunning: boolean;
  startTime: number | null;
  elapsedMs: number;
  currentSplit: number;
  splits: SplitTime[];
  // Town/Hideout time tracking
  townTimeMs: number;
  hideoutTimeMs: number;
  inTown: boolean;
  inHideout: boolean;
  townEnteredAt: number | null;
  hideoutEnteredAt: number | null;
  currentZone: string | null;
  // Death tracking
  deathCount: number;
  // Town visit & boss encounter tracking
  townVisits: TownVisit[];
  activeBossEncounter: BossEncounter | null;
  bossEncounters: BossEncounter[];
}

export interface SplitTime {
  name: string;
  splitTimeMs: number;
  segmentTimeMs: number;
  deltaMs: number | null;
  isBestSegment: boolean;
}

// Group mode types
export interface GroupMember {
  id: number;
  accountName: string;
  characterName: string | null;
  displayName: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface NewGroupMember {
  accountName: string;
  characterName?: string;
  displayName?: string;
}

export interface GroupSnapshot {
  id: number;
  runId: number;
  splitId: number;
  groupMemberId: number;
  timestamp: string;
  elapsedTimeMs: number;
  characterLevel: number;
  characterName: string;
  accountName: string;
  itemsJson: string;
  skillsJson: string;
  passiveTreeJson: string;
  statsJson: string;
  pobCode: string | null;
}

// Transient character info resolved during detection
export interface MemberCharacterInfo {
  characterClass: string;
  characterLevel: number;
  characterLeague: string;
  characterExperience: number;
}

// Practice mode types
export type PracticeMode = 'single_zone' | 'route';

export interface PracticeZone {
  name: string;           // Display name (from breakpoints)
  zoneName: string;       // Client.txt zone name (trigger.zoneName)
  act: number;
}

export interface PracticeAttempt {
  id: number;
  timeMs: number;
  completedAt: string;
  zones: string[];        // Zone names for this attempt
  deathCount: number;
}

export interface PracticeSession {
  mode: PracticeMode;
  zones: PracticeZone[];
  attempts: PracticeAttempt[];
  bestTimeMs: number | null;
}

// UI state
export type ViewMode = 'timer' | 'snapshots' | 'comparison' | 'history' | 'settings' | 'group' | 'practice';

// Filtering and analytics
export interface RunFilters {
  class?: string;
  ascendancy?: string;
  category?: string;
  league?: string;
  breakpointPreset?: string;
  status?: RunStatus;
  includeReference?: boolean;
}

export interface RunStats {
  totalRuns: number;
  completedRuns: number;
  abandonedRuns: number;
  averageTimeMs: number | null;
  bestTimeMs: number | null;
}

export interface SplitStat {
  breakpointName: string;
  averageTimeMs: number;
  bestTimeMs: number;
  averageTownTimeMs: number;
  runCount: number;
}

// Reference run data for manual entry
export interface ReferenceRunData {
  sourceName: string;
  characterName?: string;
  class: string;
  ascendancy?: string;
  category: string;
  league?: string;
  breakpointPreset?: string;
  enabledBreakpoints?: string;
  totalTimeMs: number;
  splits: ReferenceSplitData[];
}

export interface ReferenceSplitData {
  breakpointName: string;
  breakpointType: string;
  splitTimeMs: number;
  bossFightMs?: number;
  townTimeMs?: number;
}
