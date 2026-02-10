import type { Breakpoint, BreakpointType, WizardConfig } from '../types';

// Verbosity levels ordered from fewest to most splits
type VerbosityLevel = 'acts_only' | 'bosses_only' | 'key_zones' | 'every_zone';

const VERBOSITY_RANK: Record<VerbosityLevel, number> = {
  acts_only: 1,
  bosses_only: 2,
  key_zones: 3,
  every_zone: 4,
};

// Internal zone entry used for generation
interface ZoneEntry {
  name: string;             // Display name (becomes breakpoint name)
  zoneName: string;         // Exact Client.txt match
  act: number;
  bpType: BreakpointType;   // zone | boss | act
  triggerType: 'zone' | 'kitava';
  verbosity: VerbosityLevel;
  captureSnapshot: boolean;
  penalty?: number;         // For kitava triggers
}

// ── Zone data per act ──────────────────────────────────────────────

const act1Zones: ZoneEntry[] = [
  // No Twilight Strand — you start in it, can't split on it
  { name: 'The Coast', zoneName: 'The Coast', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },
  { name: 'The Tidal Island', zoneName: 'The Tidal Island', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Mud Flats', zoneName: 'The Mud Flats', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Fetid Pool', zoneName: 'The Fetid Pool', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Submerged Passage', zoneName: 'The Submerged Passage', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Flooded Depths', zoneName: 'The Flooded Depths', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Ledge', zoneName: 'The Ledge', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Climb', zoneName: 'The Climb', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Lower Prison', zoneName: 'The Lower Prison', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Upper Prison', zoneName: 'The Upper Prison', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Prisoners Gate', zoneName: "Prisoner's Gate", act: 1, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Brutus kill
  { name: 'The Ship Graveyard', zoneName: 'The Ship Graveyard', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Ship Graveyard Cave', zoneName: 'The Ship Graveyard Cave', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Cavern of Wrath', zoneName: 'The Cavern of Wrath', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Cavern of Anger', zoneName: 'The Cavern of Anger', act: 1, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },  // Merveil end-of-act (redundant with Southern Forest)
];

const act2Zones: ZoneEntry[] = [
  { name: 'The Southern Forest', zoneName: 'The Southern Forest', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'acts_only', captureSnapshot: true },  // First zone after Merveil
  { name: 'The Forest Encampment', zoneName: 'The Forest Encampment', act: 2, bpType: 'act', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: true },  // Town
  { name: 'The Old Fields', zoneName: 'The Old Fields', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Crossroads', zoneName: 'The Crossroads', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Chamber of Sins 1', zoneName: 'The Chamber of Sins Level 1', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },
  { name: 'The Chamber of Sins 2', zoneName: 'The Chamber of Sins Level 2', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Riverways', zoneName: 'The Riverways', act: 2, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Fidelitas kill
  { name: 'The Western Forest', zoneName: 'The Western Forest', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Weaver Chambers', zoneName: "The Weaver's Chambers", act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Wetlands', zoneName: 'The Wetlands', act: 2, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Weaver kill
  { name: 'The Vaal Ruins', zoneName: 'The Vaal Ruins', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Northern Forest', zoneName: 'The Northern Forest', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Caverns', zoneName: 'The Caverns', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Ancient Pyramid', zoneName: 'The Ancient Pyramid', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },  // Vaal Oversoul end-of-act (redundant with City of Sarn)
];

// Extra zones for act 2 early_crypt route variant
const act2CryptZones: ZoneEntry[] = [
  { name: 'The Fellshrine Ruins', zoneName: 'The Fellshrine Ruins', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Crypt Level 1', zoneName: 'The Crypt Level 1', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },
  { name: 'The Crypt Level 2', zoneName: 'The Crypt Level 2', act: 2, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
];

const act3Zones: ZoneEntry[] = [
  { name: 'The City of Sarn', zoneName: 'The City of Sarn', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'acts_only', captureSnapshot: true },  // First zone after Vaal Oversoul
  { name: 'The Sarn Encampment', zoneName: 'The Sarn Encampment', act: 3, bpType: 'act', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: true },  // Town
  { name: 'The Slums', zoneName: 'The Slums', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Crematorium', zoneName: 'The Crematorium', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Sewers', zoneName: 'The Sewers', act: 3, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Piety (Crematorium) kill
  { name: 'The Marketplace', zoneName: 'The Marketplace', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Catacombs', zoneName: 'The Catacombs', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Battlefront', zoneName: 'The Battlefront', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Docks', zoneName: 'The Docks', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Solaris Temple 1', zoneName: 'The Solaris Temple Level 1', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Solaris Temple 2', zoneName: 'The Solaris Temple Level 2', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Ebony Barracks', zoneName: 'The Ebony Barracks', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },
  { name: 'The Lunaris Temple 1', zoneName: 'The Lunaris Temple Level 1', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Lunaris Temple 2', zoneName: 'The Lunaris Temple Level 2', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Imperial Gardens', zoneName: 'The Imperial Gardens', act: 3, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Piety (Lunaris) kill
  { name: 'The Library', zoneName: 'The Library', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Sceptre of God', zoneName: 'The Sceptre of God', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Upper Sceptre of God', zoneName: 'The Upper Sceptre of God', act: 3, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },  // Dominus end-of-act (redundant with Aqueduct)
];

const act4Zones: ZoneEntry[] = [
  { name: 'The Aqueduct', zoneName: 'The Aqueduct', act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'acts_only', captureSnapshot: true },  // First zone after Dominus
  { name: 'Highgate (A4)', zoneName: 'Highgate', act: 4, bpType: 'act', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: true },  // Town
  { name: 'The Dried Lake', zoneName: 'The Dried Lake', act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Mines 1', zoneName: 'The Mines Level 1', act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Mines 2', zoneName: 'The Mines Level 2', act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Crystal Veins', zoneName: 'The Crystal Veins', act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },
  // Standard order: Daresso first, then Kaom
  { name: 'Daressos Dream', zoneName: "Daresso's Dream", act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Grand Arena', zoneName: 'The Grand Arena', act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Kaoms Dream', zoneName: "Kaom's Dream", act: 4, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Daresso kill
  { name: 'Kaoms Stronghold', zoneName: "Kaom's Stronghold", act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Belly of the Beast 1', zoneName: 'The Belly of the Beast Level 1', act: 4, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Kaom kill
  { name: 'The Belly of the Beast 2', zoneName: 'The Belly of the Beast Level 2', act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Harvest', zoneName: 'The Harvest', act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },  // Malachai end-of-act (redundant with Slave Pens)
];

const act5Zones: ZoneEntry[] = [
  { name: 'The Slave Pens', zoneName: 'The Slave Pens', act: 5, bpType: 'zone', triggerType: 'zone', verbosity: 'acts_only', captureSnapshot: true },
  { name: 'Overseer Tower', zoneName: "Overseer's Tower", act: 5, bpType: 'act', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: true },  // Town
  { name: 'The Control Blocks', zoneName: 'The Control Blocks', act: 5, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Oriath Square', zoneName: 'Oriath Square', act: 5, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Templar Courts', zoneName: 'The Templar Courts', act: 5, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Chamber of Innocence', zoneName: 'The Chamber of Innocence', act: 5, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Torched Courts', zoneName: 'The Torched Courts', act: 5, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Innocence kill
  { name: 'The Ruined Square', zoneName: 'The Ruined Square', act: 5, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Reliquary', zoneName: 'The Reliquary', act: 5, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Ossuary', zoneName: 'The Ossuary', act: 5, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Cathedral Rooftop', zoneName: 'The Cathedral Rooftop', act: 5, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },  // End-of-act (redundant with Twilight Strand A6)
  { name: 'Kitava (Act 5)', zoneName: '', act: 5, bpType: 'boss', triggerType: 'kitava', verbosity: 'acts_only', captureSnapshot: true, penalty: 30 },
];

const act6Zones: ZoneEntry[] = [
  { name: 'Twilight Strand (A6)', zoneName: 'The Twilight Strand', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'acts_only', captureSnapshot: true },  // First zone of act 6
  { name: 'Lioneyes Watch (A6)', zoneName: "Lioneye's Watch", act: 6, bpType: 'act', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: true },  // Town
  { name: 'The Coast (A6)', zoneName: 'The Coast', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Mud Flats (A6)', zoneName: 'The Mud Flats', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Karui Fortress', zoneName: 'The Karui Fortress', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Ridge', zoneName: 'The Ridge', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Lower Prison (A6)', zoneName: 'The Lower Prison', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Shavronne Tower', zoneName: "Shavronne's Tower", act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Prisoners Gate (A6)', zoneName: "Prisoner's Gate", act: 6, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Shavronne kill
  { name: 'The Western Forest (A6)', zoneName: 'The Western Forest', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Riverways (A6)', zoneName: 'The Riverways', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Wetlands (A6)', zoneName: 'The Wetlands', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Southern Forest (A6)', zoneName: 'The Southern Forest', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Cavern of Anger (A6)', zoneName: 'The Cavern of Anger', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Beacon', zoneName: 'The Beacon', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Brine King Reef', zoneName: "The Brine King's Reef", act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },  // Brine King end-of-act (redundant with Broken Bridge A7)
];

// Tidal Island zone for act 6 add_tidal variant
const act6TidalZone: ZoneEntry = {
  name: 'The Tidal Island (A6)', zoneName: 'The Tidal Island', act: 6, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false,
};

const act7Zones: ZoneEntry[] = [
  { name: 'The Broken Bridge', zoneName: 'The Broken Bridge', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'acts_only', captureSnapshot: true },
  { name: 'The Crossroads (A7)', zoneName: 'The Crossroads', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Fellshrine Ruins', zoneName: 'The Fellshrine Ruins', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Crypt (A7)', zoneName: 'The Crypt', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Chamber of Sins 1 (A7)', zoneName: 'The Chamber of Sins Level 1', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Chamber of Sins 2 (A7)', zoneName: 'The Chamber of Sins Level 2', act: 7, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Maligaro kill
  { name: 'The Den', zoneName: 'The Den', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Ashen Fields', zoneName: 'The Ashen Fields', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Northern Forest (A7)', zoneName: 'The Northern Forest', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Dread Thicket', zoneName: 'The Dread Thicket', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Causeway', zoneName: 'The Causeway', act: 7, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Gruthkul kill
  { name: 'The Vaal City', zoneName: 'The Vaal City', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Temple of Decay 1', zoneName: 'The Temple of Decay Level 1', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Temple of Decay 2', zoneName: 'The Temple of Decay Level 2', act: 7, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },  // Arakaali end-of-act (redundant with Sarn Ramparts A8)
  { name: 'The Bridge Encampment', zoneName: 'The Bridge Encampment', act: 7, bpType: 'act', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: true },  // Town
];

const act8Zones: ZoneEntry[] = [
  { name: 'The Sarn Ramparts', zoneName: 'The Sarn Ramparts', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'acts_only', captureSnapshot: true },
  { name: 'The Sarn Encampment (A8)', zoneName: 'The Sarn Encampment', act: 8, bpType: 'act', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: true },  // Town
  { name: 'The Toxic Conduits', zoneName: 'The Toxic Conduits', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Doedres Cesspool', zoneName: "Doedre's Cesspool", act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Quay', zoneName: 'The Quay', act: 8, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Doedre kill
  { name: 'The Grain Gate', zoneName: 'The Grain Gate', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Imperial Fields', zoneName: 'The Imperial Fields', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Hidden Underbelly', zoneName: 'The Hidden Underbelly', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  // Standard order: Solaris side first (new meta)
  { name: 'The Grand Promenade', zoneName: 'The Grand Promenade', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The High Gardens', zoneName: 'The High Gardens', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Bath House', zoneName: 'The Bath House', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Lunaris Concourse', zoneName: 'The Lunaris Concourse', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },
  { name: 'The Lunaris Temple 1 (A8)', zoneName: 'The Lunaris Temple Level 1', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Lunaris Temple 2 (A8)', zoneName: 'The Lunaris Temple Level 2', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Solaris Concourse', zoneName: 'The Solaris Concourse', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },
  { name: 'The Solaris Temple 1 (A8)', zoneName: 'The Solaris Temple Level 1', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Solaris Temple 2 (A8)', zoneName: 'The Solaris Temple Level 2', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Harbour Bridge', zoneName: 'The Harbour Bridge', act: 8, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: false },  // Solaris/Lunaris end-of-act (redundant with Blood Aqueduct A9)
];

const act9Zones: ZoneEntry[] = [
  { name: 'The Blood Aqueduct', zoneName: 'The Blood Aqueduct', act: 9, bpType: 'zone', triggerType: 'zone', verbosity: 'acts_only', captureSnapshot: true },
  { name: 'Highgate (A9)', zoneName: 'Highgate', act: 9, bpType: 'act', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: true },  // Town
  { name: 'The Descent', zoneName: 'The Descent', act: 9, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Vastiri Desert', zoneName: 'The Vastiri Desert', act: 9, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Oasis', zoneName: 'The Oasis', act: 9, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Foothills', zoneName: 'The Foothills', act: 9, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Boiling Lake', zoneName: 'The Boiling Lake', act: 9, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Tunnel', zoneName: 'The Tunnel', act: 9, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Basilisk/Shakari kill
  { name: 'The Quarry', zoneName: 'The Quarry', act: 9, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Refinery', zoneName: 'The Refinery', act: 9, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Belly of the Beast (A9)', zoneName: 'The Belly of the Beast', act: 9, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Quarry bosses kill (Garukhan/Ralakesh)
  { name: 'The Rotting Core', zoneName: 'The Rotting Core', act: 9, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
];

const act10Zones: ZoneEntry[] = [
  { name: 'The Cathedral Rooftop (A10)', zoneName: 'The Cathedral Rooftop', act: 10, bpType: 'zone', triggerType: 'zone', verbosity: 'acts_only', captureSnapshot: true },
  { name: 'Oriath Docks', zoneName: 'Oriath Docks', act: 10, bpType: 'act', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: true },  // Town
  { name: 'The Ravaged Square', zoneName: 'The Ravaged Square', act: 10, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Torched Courts (A10)', zoneName: 'The Torched Courts', act: 10, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Desecrated Chambers', zoneName: 'The Desecrated Chambers', act: 10, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'The Canals', zoneName: 'The Canals', act: 10, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Vilenta kill
  { name: 'The Feeding Trough', zoneName: 'The Feeding Trough', act: 10, bpType: 'zone', triggerType: 'zone', verbosity: 'key_zones', captureSnapshot: true },  // End-of-act (Kitava trigger handles actual kill)
  { name: 'Kitava (Act 10)', zoneName: '', act: 10, bpType: 'boss', triggerType: 'kitava', verbosity: 'acts_only', captureSnapshot: true, penalty: 60 },
];

const levelMilestones: ZoneEntry[] = [
  { name: 'Level 10', zoneName: '', act: 0, bpType: 'level', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Level 20', zoneName: '', act: 0, bpType: 'level', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Level 30', zoneName: '', act: 0, bpType: 'level', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Level 40', zoneName: '', act: 0, bpType: 'level', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Level 50', zoneName: '', act: 0, bpType: 'level', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Level 60', zoneName: '', act: 0, bpType: 'level', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Level 70', zoneName: '', act: 0, bpType: 'level', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Level 80', zoneName: '', act: 0, bpType: 'level', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
  { name: 'Level 90', zoneName: '', act: 0, bpType: 'level', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
];

// ── All acts map ───────────────────────────────────────────────────

const ALL_ACT_ZONES: Record<number, ZoneEntry[]> = {
  1: act1Zones,
  2: act2Zones,
  3: act3Zones,
  4: act4Zones,
  5: act5Zones,
  6: act6Zones,
  7: act7Zones,
  8: act8Zones,
  9: act9Zones,
  10: act10Zones,
};

// ── Route variant functions ────────────────────────────────────────

function applyAct1EarlyDweller(zones: ZoneEntry[]): ZoneEntry[] {
  // Move Tidal Island to right after Mud Flats
  const result = zones.filter(z => z.name !== 'The Tidal Island');
  const mudFlatsIdx = result.findIndex(z => z.name === 'The Mud Flats');
  if (mudFlatsIdx >= 0) {
    const tidalIsland = zones.find(z => z.name === 'The Tidal Island');
    if (tidalIsland) {
      // Promote to key_zones since it's now a deliberate routing choice
      result.splice(mudFlatsIdx + 1, 0, { ...tidalIsland, verbosity: 'key_zones' });
    }
  }
  return result;
}

function applyAct2EarlyCrypt(zones: ZoneEntry[]): ZoneEntry[] {
  // Insert Fellshrine → Crypt L1 → Crypt L2 between Crossroads and Chamber of Sins
  const result = [...zones];
  const crossroadsIdx = result.findIndex(z => z.name === 'The Crossroads');
  if (crossroadsIdx >= 0) {
    result.splice(crossroadsIdx + 1, 0, ...act2CryptZones);
  }
  return result;
}

function applyAct4KaomFirst(zones: ZoneEntry[]): ZoneEntry[] {
  // Reorder: Kaom's Dream/Stronghold before Daresso's Dream/Grand Arena
  // Also swap boss kill markers: Daresso's Dream becomes Kaom kill, Belly of Beast 1 becomes Daresso kill
  const result = [...zones];

  // Remove the 4 side zones + Belly of Beast 1 (need to reassign markers)
  const names = ['Daressos Dream', 'The Grand Arena', 'Kaoms Dream', 'Kaoms Stronghold', 'The Belly of the Beast 1'];
  const filtered = result.filter(z => !names.includes(z.name));

  // Find Crystal Veins position to insert after
  const crystalIdx = filtered.findIndex(z => z.name === 'The Crystal Veins');
  const insertIdx = crystalIdx >= 0 ? crystalIdx + 1 : filtered.length;

  // Kaom first: Kaom's Dream → Kaom's Stronghold → Daresso's Dream (Kaom kill) → Grand Arena → Belly of Beast 1 (Daresso kill)
  const reordered: ZoneEntry[] = [
    { name: 'Kaoms Dream', zoneName: "Kaom's Dream", act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
    { name: 'Kaoms Stronghold', zoneName: "Kaom's Stronghold", act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
    { name: 'Daressos Dream', zoneName: "Daresso's Dream", act: 4, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Kaom kill
    { name: 'The Grand Arena', zoneName: 'The Grand Arena', act: 4, bpType: 'zone', triggerType: 'zone', verbosity: 'every_zone', captureSnapshot: false },
    { name: 'The Belly of the Beast 1', zoneName: 'The Belly of the Beast Level 1', act: 4, bpType: 'boss', triggerType: 'zone', verbosity: 'bosses_only', captureSnapshot: false },  // Daresso kill
  ];
  filtered.splice(insertIdx, 0, ...reordered);
  return filtered;
}

function applyAct6SkipLily(zones: ZoneEntry[]): ZoneEntry[] {
  return zones.filter(z => z.name !== 'Twilight Strand (A6)');
}

function applyAct6AddTidal(zones: ZoneEntry[]): ZoneEntry[] {
  const result = [...zones];
  const coastIdx = result.findIndex(z => z.name === 'The Coast (A6)');
  if (coastIdx >= 0) {
    result.splice(coastIdx + 1, 0, act6TidalZone);
  }
  return result;
}

function applyAct8Legacy(zones: ZoneEntry[]): ZoneEntry[] {
  // Legacy routing: Lunaris side before Solaris side
  // In standard (new meta), the order is already Solaris-adjacent zones first
  // Legacy swaps to: Lunaris Concourse → Lunaris Temples → Solaris Concourse → Solaris Temples
  const result = [...zones];

  const lunarisNames = ['The Lunaris Concourse', 'The Lunaris Temple 1 (A8)', 'The Lunaris Temple 2 (A8)'];
  const solarisNames = ['The Solaris Concourse', 'The Solaris Temple 1 (A8)', 'The Solaris Temple 2 (A8)'];
  const middleNames = ['The Grand Promenade', 'The High Gardens', 'The Bath House'];

  const lunaris = result.filter(z => lunarisNames.includes(z.name));
  const solaris = result.filter(z => solarisNames.includes(z.name));
  const middle = result.filter(z => middleNames.includes(z.name));
  const allReorderedNames = [...lunarisNames, ...solarisNames, ...middleNames];

  const filtered = result.filter(z => !allReorderedNames.includes(z.name));

  // Find the insertion point (after Hidden Underbelly, before Harbour Bridge)
  const insertIdx = filtered.findIndex(z => z.name === 'The Harbour Bridge');
  if (insertIdx >= 0) {
    // Legacy order: Lunaris side first, then middle zones, then Solaris
    filtered.splice(insertIdx, 0, ...lunaris, ...middle, ...solaris);
  }

  return filtered;
}

// ── Zone entry to Breakpoint conversion ────────────────────────────

function zoneToBreakpoint(zone: ZoneEntry): Breakpoint {
  if (zone.bpType === 'level') {
    const level = parseInt(zone.name.replace('Level ', ''));
    return {
      name: zone.name,
      type: 'level',
      trigger: { type: 'level', level },
      isEnabled: false,  // Level milestones disabled by default
      captureSnapshot: zone.captureSnapshot,
    };
  }

  if (zone.triggerType === 'kitava') {
    return {
      name: zone.name,
      type: zone.bpType,
      trigger: { type: 'kitava', penalty: zone.penalty!, act: zone.act },
      isEnabled: true,
      captureSnapshot: zone.captureSnapshot,
    };
  }

  return {
    name: zone.name,
    type: zone.bpType,
    trigger: { type: 'zone', zoneName: zone.zoneName, act: zone.act },
    isEnabled: true,
    captureSnapshot: zone.captureSnapshot,
  };
}

// ── Main generation function ───────────────────────────────────────

export function generateBreakpoints(config: WizardConfig): Breakpoint[] {
  const maxAct = config.endAct;
  let allZones: ZoneEntry[] = [];

  // 1. Build zone list for acts 1 through endAct
  for (let act = 1; act <= maxAct; act++) {
    let actZones = [...(ALL_ACT_ZONES[act] || [])];

    // 2. Apply route variants
    if (act === 1 && config.routes.act1 === 'early_dweller') {
      actZones = applyAct1EarlyDweller(actZones);
    }
    if (act === 2 && config.routes.act2 === 'early_crypt') {
      actZones = applyAct2EarlyCrypt(actZones);
    }
    if (act === 4 && config.routes.act4 === 'kaom_first') {
      actZones = applyAct4KaomFirst(actZones);
    }
    if (act === 6 && config.routes.act6SkipLily) {
      actZones = applyAct6SkipLily(actZones);
    }
    if (act === 6 && config.routes.act6AddTidal) {
      actZones = applyAct6AddTidal(actZones);
    }
    if (act === 8 && config.routes.act8 === 'legacy') {
      actZones = applyAct8Legacy(actZones);
    }

    allZones.push(...actZones);
  }

  // 3. Filter by verbosity
  const filtered = allZones.filter(z =>
    VERBOSITY_RANK[config.verbosity] >= VERBOSITY_RANK[z.verbosity]
  );

  // 4. Apply snapshot frequency on zone data (where verbosity info is available)
  //    acts_only  = zones with verbosity 'acts_only' (first zone of each act + Kitava kills)
  //    bosses_only = above + all boss encounters + act/town entries
  const snapshotFreq = config.snapshotFrequency || 'acts_only';
  const withSnapshots = filtered.map(zone => ({
    ...zone,
    captureSnapshot: snapshotFreq === 'acts_only'
      ? zone.verbosity === 'acts_only'
      : zone.bpType === 'boss' || zone.bpType === 'act' || zone.verbosity === 'acts_only',
  }));

  // 5. Convert to Breakpoint[]
  const breakpoints = withSnapshots.map(zoneToBreakpoint);

  // 6. Append level milestones (disabled by default, no snapshots)
  breakpoints.push(...levelMilestones.map(zoneToBreakpoint));

  return breakpoints;
}

// ── Helper to count splits for a config ────────────────────────────

export function countSplits(config: WizardConfig): number {
  const bps = generateBreakpoints(config);
  return bps.filter(bp => bp.isEnabled).length;
}

// ── Group breakpoints by act for preview ───────────────────────────

export function groupByAct(breakpoints: Breakpoint[]): Map<number, Breakpoint[]> {
  const groups = new Map<number, Breakpoint[]>();
  for (const bp of breakpoints) {
    if (!bp.isEnabled) continue;
    const act = bp.trigger.act ?? 0;
    if (!groups.has(act)) groups.set(act, []);
    groups.get(act)!.push(bp);
  }
  return groups;
}

// ── Derive human-readable category from wizard config ──────────────

export function getWizardCategory(config: WizardConfig): string {
  const actLabel = `Act ${config.endAct}`;
  const typeLabel = config.runType === 'any_percent' ? 'Any%' : '100%';
  return `${actLabel} ${typeLabel}`;
}

// ── Default wizard config ──────────────────────────────────────────

export const DEFAULT_WIZARD_CONFIG: WizardConfig = {
  endAct: 10,
  runType: 'any_percent',
  verbosity: 'key_zones',
  snapshotFrequency: 'acts_only',
  routes: {
    act1: 'standard',
    act2: 'standard',
    act4: 'standard',
    act6SkipLily: false,
    act6AddTidal: false,
    act8: 'standard',
  },
};
