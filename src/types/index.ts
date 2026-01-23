// Core types for POE Watcher

export interface Run {
  id: number;
  characterName: string;
  accountName: string;
  class: string;
  ascendancy: string | null;
  league: string;
  category: string;
  startedAt: string;
  endedAt: string | null;
  totalTimeMs: number | null;
  isCompleted: boolean;
  isPersonalBest: boolean;
}

export interface Split {
  id: number;
  runId: number;
  breakpointType: BreakpointType;
  breakpointName: string;
  splitTimeMs: number;
  deltaMs: number | null;
  segmentTimeMs: number;
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
  | 'login';

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
}

export interface BreakpointTrigger {
  type: 'zone' | 'level' | 'boss';
  zoneName?: string;
  act?: number;
  level?: number;
}

// Settings
export interface Settings {
  poeLogPath: string;
  accountName: string;
  checkUpdates: boolean;
  overlayEnabled: boolean;
  overlayOpacity: number;
  soundEnabled: boolean;
  breakpoints: Breakpoint[];
}

// POE API types
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
}

export interface PoeSocket {
  group: number;
  attr: string;
}

export interface PoePassiveSkills {
  hashes: number[];
  jewelData?: Record<string, unknown>;
}

// Timer state
export interface TimerState {
  isRunning: boolean;
  startTime: number | null;
  elapsedMs: number;
  currentSplit: number;
  splits: SplitTime[];
}

export interface SplitTime {
  name: string;
  splitTimeMs: number;
  segmentTimeMs: number;
  deltaMs: number | null;
  isBestSegment: boolean;
}

// UI state
export type ViewMode = 'timer' | 'snapshots' | 'comparison' | 'settings';
