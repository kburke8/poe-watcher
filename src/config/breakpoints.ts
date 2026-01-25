import type { Breakpoint } from '../types';

// All POE zones organized by act - comprehensive list for speedrunning
export const defaultBreakpoints: Breakpoint[] = [
  // ===== ACT 1 =====
  { name: 'Twilight Strand', type: 'zone', trigger: { type: 'zone', zoneName: 'The Twilight Strand', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Coast', type: 'zone', trigger: { type: 'zone', zoneName: 'The Coast', act: 1 }, isEnabled: true, captureSnapshot: false },
  { name: 'The Tidal Island', type: 'zone', trigger: { type: 'zone', zoneName: 'The Tidal Island', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Mud Flats', type: 'zone', trigger: { type: 'zone', zoneName: 'The Mud Flats', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Fetid Pool', type: 'zone', trigger: { type: 'zone', zoneName: 'The Fetid Pool', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Submerged Passage', type: 'zone', trigger: { type: 'zone', zoneName: 'The Submerged Passage', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Flooded Depths', type: 'zone', trigger: { type: 'zone', zoneName: 'The Flooded Depths', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Ledge', type: 'zone', trigger: { type: 'zone', zoneName: 'The Ledge', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Climb', type: 'zone', trigger: { type: 'zone', zoneName: 'The Climb', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Lower Prison', type: 'zone', trigger: { type: 'zone', zoneName: 'The Lower Prison', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Upper Prison', type: 'zone', trigger: { type: 'zone', zoneName: 'The Upper Prison', act: 1 }, isEnabled: true, captureSnapshot: false },
  { name: 'Prisoners Gate', type: 'zone', trigger: { type: 'zone', zoneName: "Prisoner's Gate", act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Ship Graveyard', type: 'zone', trigger: { type: 'zone', zoneName: 'The Ship Graveyard', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Ship Graveyard Cave', type: 'zone', trigger: { type: 'zone', zoneName: 'The Ship Graveyard Cave', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Cavern of Wrath', type: 'zone', trigger: { type: 'zone', zoneName: 'The Cavern of Wrath', act: 1 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Cavern of Anger', type: 'boss', trigger: { type: 'zone', zoneName: 'The Cavern of Anger', act: 1 }, isEnabled: true, captureSnapshot: false },

  // ===== ACT 2 =====
  // Post-Merveil - first zone after Act 1 boss
  { name: 'The Southern Forest', type: 'zone', trigger: { type: 'zone', zoneName: 'The Southern Forest', act: 2 }, isEnabled: false, captureSnapshot: true },
  // Act 2 town start
  { name: 'The Forest Encampment', type: 'act', trigger: { type: 'zone', zoneName: 'The Forest Encampment', act: 2 }, isEnabled: true, captureSnapshot: true },
  { name: 'The Old Fields', type: 'zone', trigger: { type: 'zone', zoneName: 'The Old Fields', act: 2 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Crossroads', type: 'zone', trigger: { type: 'zone', zoneName: 'The Crossroads', act: 2 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Chamber of Sins 1', type: 'zone', trigger: { type: 'zone', zoneName: 'The Chamber of Sins Level 1', act: 2 }, isEnabled: true, captureSnapshot: false },
  { name: 'The Chamber of Sins 2', type: 'zone', trigger: { type: 'zone', zoneName: 'The Chamber of Sins Level 2', act: 2 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Riverways', type: 'zone', trigger: { type: 'zone', zoneName: 'The Riverways', act: 2 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Western Forest', type: 'zone', trigger: { type: 'zone', zoneName: 'The Western Forest', act: 2 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Weaver Chambers', type: 'zone', trigger: { type: 'zone', zoneName: "The Weaver's Chambers", act: 2 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Wetlands', type: 'zone', trigger: { type: 'zone', zoneName: 'The Wetlands', act: 2 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Vaal Ruins', type: 'zone', trigger: { type: 'zone', zoneName: 'The Vaal Ruins', act: 2 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Northern Forest', type: 'zone', trigger: { type: 'zone', zoneName: 'The Northern Forest', act: 2 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Caverns', type: 'zone', trigger: { type: 'zone', zoneName: 'The Caverns', act: 2 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Ancient Pyramid', type: 'boss', trigger: { type: 'zone', zoneName: 'The Ancient Pyramid', act: 2 }, isEnabled: true, captureSnapshot: false },

  // ===== ACT 3 =====
  // Post-Vaal Oversoul - first zone after Act 2 boss
  { name: 'The City of Sarn', type: 'zone', trigger: { type: 'zone', zoneName: 'The City of Sarn', act: 3 }, isEnabled: false, captureSnapshot: true },
  // Act 3 town start
  { name: 'The Sarn Encampment', type: 'act', trigger: { type: 'zone', zoneName: 'The Sarn Encampment', act: 3 }, isEnabled: true, captureSnapshot: true },
  { name: 'The Slums', type: 'zone', trigger: { type: 'zone', zoneName: 'The Slums', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Crematorium', type: 'zone', trigger: { type: 'zone', zoneName: 'The Crematorium', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Sewers', type: 'zone', trigger: { type: 'zone', zoneName: 'The Sewers', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Marketplace', type: 'zone', trigger: { type: 'zone', zoneName: 'The Marketplace', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Catacombs', type: 'zone', trigger: { type: 'zone', zoneName: 'The Catacombs', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Battlefront', type: 'zone', trigger: { type: 'zone', zoneName: 'The Battlefront', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Docks', type: 'zone', trigger: { type: 'zone', zoneName: 'The Docks', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Solaris Temple 1', type: 'zone', trigger: { type: 'zone', zoneName: 'The Solaris Temple Level 1', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Solaris Temple 2', type: 'zone', trigger: { type: 'zone', zoneName: 'The Solaris Temple Level 2', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Ebony Barracks', type: 'zone', trigger: { type: 'zone', zoneName: 'The Ebony Barracks', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Lunaris Temple 1', type: 'zone', trigger: { type: 'zone', zoneName: 'The Lunaris Temple Level 1', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Lunaris Temple 2', type: 'zone', trigger: { type: 'zone', zoneName: 'The Lunaris Temple Level 2', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Imperial Gardens', type: 'zone', trigger: { type: 'zone', zoneName: 'The Imperial Gardens', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Library', type: 'zone', trigger: { type: 'zone', zoneName: 'The Library', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Sceptre of God', type: 'zone', trigger: { type: 'zone', zoneName: 'The Sceptre of God', act: 3 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Upper Sceptre of God', type: 'boss', trigger: { type: 'zone', zoneName: 'The Upper Sceptre of God', act: 3 }, isEnabled: true, captureSnapshot: false },

  // ===== ACT 4 =====
  // Post-Dominus - first zone after Act 3 boss
  { name: 'The Aqueduct', type: 'zone', trigger: { type: 'zone', zoneName: 'The Aqueduct', act: 4 }, isEnabled: false, captureSnapshot: true },
  // Act 4 town start
  { name: 'Highgate (A4)', type: 'act', trigger: { type: 'zone', zoneName: 'Highgate', act: 4 }, isEnabled: true, captureSnapshot: true },
  { name: 'The Dried Lake', type: 'zone', trigger: { type: 'zone', zoneName: 'The Dried Lake', act: 4 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Mines 1', type: 'zone', trigger: { type: 'zone', zoneName: 'The Mines Level 1', act: 4 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Mines 2', type: 'zone', trigger: { type: 'zone', zoneName: 'The Mines Level 2', act: 4 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Crystal Veins', type: 'zone', trigger: { type: 'zone', zoneName: 'The Crystal Veins', act: 4 }, isEnabled: false, captureSnapshot: false },
  { name: 'Kaoms Dream', type: 'zone', trigger: { type: 'zone', zoneName: "Kaom's Dream", act: 4 }, isEnabled: false, captureSnapshot: false },
  { name: 'Kaoms Stronghold', type: 'zone', trigger: { type: 'zone', zoneName: "Kaom's Stronghold", act: 4 }, isEnabled: false, captureSnapshot: false },
  { name: 'Daressos Dream', type: 'zone', trigger: { type: 'zone', zoneName: "Daresso's Dream", act: 4 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Grand Arena', type: 'zone', trigger: { type: 'zone', zoneName: 'The Grand Arena', act: 4 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Belly of the Beast 1', type: 'zone', trigger: { type: 'zone', zoneName: 'The Belly of the Beast Level 1', act: 4 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Belly of the Beast 2', type: 'zone', trigger: { type: 'zone', zoneName: 'The Belly of the Beast Level 2', act: 4 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Harvest', type: 'boss', trigger: { type: 'zone', zoneName: 'The Harvest', act: 4 }, isEnabled: true, captureSnapshot: false },

  // ===== ACT 5 =====
  // Post-Malachai - first zone after Act 4 boss
  { name: 'The Slave Pens', type: 'zone', trigger: { type: 'zone', zoneName: 'The Slave Pens', act: 5 }, isEnabled: false, captureSnapshot: true },
  // Act 5 town start
  { name: 'Overseer Tower', type: 'act', trigger: { type: 'zone', zoneName: "Overseer's Tower", act: 5 }, isEnabled: true, captureSnapshot: true },
  { name: 'The Control Blocks', type: 'zone', trigger: { type: 'zone', zoneName: 'The Control Blocks', act: 5 }, isEnabled: false, captureSnapshot: false },
  { name: 'Oriath Square', type: 'zone', trigger: { type: 'zone', zoneName: 'Oriath Square', act: 5 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Templar Courts', type: 'zone', trigger: { type: 'zone', zoneName: 'The Templar Courts', act: 5 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Chamber of Innocence', type: 'zone', trigger: { type: 'zone', zoneName: 'The Chamber of Innocence', act: 5 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Torched Courts', type: 'zone', trigger: { type: 'zone', zoneName: 'The Torched Courts', act: 5 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Ruined Square', type: 'zone', trigger: { type: 'zone', zoneName: 'The Ruined Square', act: 5 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Reliquary', type: 'zone', trigger: { type: 'zone', zoneName: 'The Reliquary', act: 5 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Ossuary', type: 'zone', trigger: { type: 'zone', zoneName: 'The Ossuary', act: 5 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Cathedral Rooftop', type: 'boss', trigger: { type: 'zone', zoneName: 'The Cathedral Rooftop', act: 5 }, isEnabled: true, captureSnapshot: false },

  // ===== ACT 6 =====
  { name: 'Twilight Strand (A6)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Twilight Strand', act: 6 }, isEnabled: false, captureSnapshot: false },
  // Act 6 town start (also post-Kitava Act 5)
  { name: 'Lioneyes Watch (A6)', type: 'act', trigger: { type: 'zone', zoneName: "Lioneye's Watch", act: 6 }, isEnabled: true, captureSnapshot: true },
  { name: 'The Coast (A6)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Coast', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Mud Flats (A6)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Mud Flats', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Karui Fortress', type: 'zone', trigger: { type: 'zone', zoneName: 'The Karui Fortress', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Ridge', type: 'zone', trigger: { type: 'zone', zoneName: 'The Ridge', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Lower Prison (A6)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Lower Prison', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'Shavronne Tower', type: 'zone', trigger: { type: 'zone', zoneName: "Shavronne's Tower", act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'Prisoners Gate (A6)', type: 'zone', trigger: { type: 'zone', zoneName: "Prisoner's Gate", act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Western Forest (A6)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Western Forest', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Riverways (A6)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Riverways', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Wetlands (A6)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Wetlands', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Southern Forest (A6)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Southern Forest', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Cavern of Anger (A6)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Cavern of Anger', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Beacon', type: 'zone', trigger: { type: 'zone', zoneName: 'The Beacon', act: 6 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Brine King Reef', type: 'boss', trigger: { type: 'zone', zoneName: "The Brine King's Reef", act: 6 }, isEnabled: true, captureSnapshot: false },

  // ===== ACT 7 =====
  // Post-Brine King - first zone after Act 6 boss
  { name: 'The Broken Bridge', type: 'zone', trigger: { type: 'zone', zoneName: 'The Broken Bridge', act: 7 }, isEnabled: false, captureSnapshot: true },
  { name: 'The Crossroads (A7)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Crossroads', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Fellshrine Ruins', type: 'zone', trigger: { type: 'zone', zoneName: 'The Fellshrine Ruins', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Crypt (A7)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Crypt', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Chamber of Sins 1 (A7)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Chamber of Sins Level 1', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Chamber of Sins 2 (A7)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Chamber of Sins Level 2', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Den', type: 'zone', trigger: { type: 'zone', zoneName: 'The Den', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Ashen Fields', type: 'zone', trigger: { type: 'zone', zoneName: 'The Ashen Fields', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Northern Forest (A7)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Northern Forest', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Dread Thicket', type: 'zone', trigger: { type: 'zone', zoneName: 'The Dread Thicket', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Causeway', type: 'zone', trigger: { type: 'zone', zoneName: 'The Causeway', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Vaal City', type: 'zone', trigger: { type: 'zone', zoneName: 'The Vaal City', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Temple of Decay 1', type: 'zone', trigger: { type: 'zone', zoneName: 'The Temple of Decay Level 1', act: 7 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Temple of Decay 2', type: 'boss', trigger: { type: 'zone', zoneName: 'The Temple of Decay Level 2', act: 7 }, isEnabled: true, captureSnapshot: false },
  // Act 7 town start
  { name: 'The Bridge Encampment', type: 'act', trigger: { type: 'zone', zoneName: 'The Bridge Encampment', act: 7 }, isEnabled: true, captureSnapshot: true },

  // ===== ACT 8 =====
  // Post-Arakaali - first zone after Act 7 boss
  { name: 'The Sarn Ramparts', type: 'zone', trigger: { type: 'zone', zoneName: 'The Sarn Ramparts', act: 8 }, isEnabled: false, captureSnapshot: true },
  // Act 8 town start
  { name: 'The Sarn Encampment (A8)', type: 'act', trigger: { type: 'zone', zoneName: 'The Sarn Encampment', act: 8 }, isEnabled: true, captureSnapshot: true },
  { name: 'The Toxic Conduits', type: 'zone', trigger: { type: 'zone', zoneName: 'The Toxic Conduits', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'Doedres Cesspool', type: 'zone', trigger: { type: 'zone', zoneName: "Doedre's Cesspool", act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Quay', type: 'zone', trigger: { type: 'zone', zoneName: 'The Quay', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Grain Gate', type: 'zone', trigger: { type: 'zone', zoneName: 'The Grain Gate', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Imperial Fields', type: 'zone', trigger: { type: 'zone', zoneName: 'The Imperial Fields', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Hidden Underbelly', type: 'zone', trigger: { type: 'zone', zoneName: 'The Hidden Underbelly', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Grand Promenade', type: 'zone', trigger: { type: 'zone', zoneName: 'The Grand Promenade', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The High Gardens', type: 'zone', trigger: { type: 'zone', zoneName: 'The High Gardens', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Bath House', type: 'zone', trigger: { type: 'zone', zoneName: 'The Bath House', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Lunaris Concourse', type: 'zone', trigger: { type: 'zone', zoneName: 'The Lunaris Concourse', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Lunaris Temple 1 (A8)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Lunaris Temple Level 1', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Lunaris Temple 2 (A8)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Lunaris Temple Level 2', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Solaris Concourse', type: 'zone', trigger: { type: 'zone', zoneName: 'The Solaris Concourse', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Solaris Temple 1 (A8)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Solaris Temple Level 1', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Solaris Temple 2 (A8)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Solaris Temple Level 2', act: 8 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Harbour Bridge', type: 'boss', trigger: { type: 'zone', zoneName: 'The Harbour Bridge', act: 8 }, isEnabled: true, captureSnapshot: false },

  // ===== ACT 9 =====
  // Post-Lunaris/Solaris - first zone after Act 8 boss
  { name: 'The Blood Aqueduct', type: 'zone', trigger: { type: 'zone', zoneName: 'The Blood Aqueduct', act: 9 }, isEnabled: false, captureSnapshot: true },
  // Act 9 town start
  { name: 'Highgate (A9)', type: 'act', trigger: { type: 'zone', zoneName: 'Highgate', act: 9 }, isEnabled: true, captureSnapshot: true },
  { name: 'The Descent', type: 'zone', trigger: { type: 'zone', zoneName: 'The Descent', act: 9 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Vastiri Desert', type: 'zone', trigger: { type: 'zone', zoneName: 'The Vastiri Desert', act: 9 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Oasis', type: 'zone', trigger: { type: 'zone', zoneName: 'The Oasis', act: 9 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Foothills', type: 'zone', trigger: { type: 'zone', zoneName: 'The Foothills', act: 9 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Boiling Lake', type: 'zone', trigger: { type: 'zone', zoneName: 'The Boiling Lake', act: 9 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Tunnel', type: 'zone', trigger: { type: 'zone', zoneName: 'The Tunnel', act: 9 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Quarry', type: 'zone', trigger: { type: 'zone', zoneName: 'The Quarry', act: 9 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Refinery', type: 'zone', trigger: { type: 'zone', zoneName: 'The Refinery', act: 9 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Belly of the Beast (A9)', type: 'boss', trigger: { type: 'zone', zoneName: 'The Belly of the Beast', act: 9 }, isEnabled: true, captureSnapshot: false },
  { name: 'The Rotting Core', type: 'zone', trigger: { type: 'zone', zoneName: 'The Rotting Core', act: 9 }, isEnabled: false, captureSnapshot: false },

  // ===== ACT 10 =====
  // Post-Depraved Trinity - first zone after Act 9 boss
  { name: 'The Cathedral Rooftop (A10)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Cathedral Rooftop', act: 10 }, isEnabled: false, captureSnapshot: true },
  // Act 10 town start
  { name: 'Oriath Docks', type: 'act', trigger: { type: 'zone', zoneName: 'Oriath Docks', act: 10 }, isEnabled: true, captureSnapshot: true },
  { name: 'The Ravaged Square', type: 'zone', trigger: { type: 'zone', zoneName: 'The Ravaged Square', act: 10 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Torched Courts (A10)', type: 'zone', trigger: { type: 'zone', zoneName: 'The Torched Courts', act: 10 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Desecrated Chambers', type: 'zone', trigger: { type: 'zone', zoneName: 'The Desecrated Chambers', act: 10 }, isEnabled: false, captureSnapshot: false },
  { name: 'The Canals', type: 'zone', trigger: { type: 'zone', zoneName: 'The Canals', act: 10 }, isEnabled: false, captureSnapshot: false },
  // Final boss - end of campaign, final snapshot
  { name: 'The Feeding Trough', type: 'boss', trigger: { type: 'zone', zoneName: 'The Feeding Trough', act: 10 }, isEnabled: true, captureSnapshot: true },

  // ===== LEVEL MILESTONES =====
  { name: 'Level 10', type: 'level', trigger: { type: 'level', level: 10 }, isEnabled: false, captureSnapshot: false },
  { name: 'Level 20', type: 'level', trigger: { type: 'level', level: 20 }, isEnabled: false, captureSnapshot: false },
  { name: 'Level 30', type: 'level', trigger: { type: 'level', level: 30 }, isEnabled: false, captureSnapshot: false },
  { name: 'Level 40', type: 'level', trigger: { type: 'level', level: 40 }, isEnabled: false, captureSnapshot: false },
  { name: 'Level 50', type: 'level', trigger: { type: 'level', level: 50 }, isEnabled: false, captureSnapshot: false },
  { name: 'Level 60', type: 'level', trigger: { type: 'level', level: 60 }, isEnabled: false, captureSnapshot: false },
  { name: 'Level 70', type: 'level', trigger: { type: 'level', level: 70 }, isEnabled: false, captureSnapshot: false },
  { name: 'Level 80', type: 'level', trigger: { type: 'level', level: 80 }, isEnabled: false, captureSnapshot: false },
  { name: 'Level 90', type: 'level', trigger: { type: 'level', level: 90 }, isEnabled: false, captureSnapshot: false },
];

// Town zones for tracking "town time"
export const townZones: string[] = [
  // Act towns
  "Lioneye's Watch",
  'The Forest Encampment',
  'The Sarn Encampment',
  'Highgate',
  "Overseer's Tower",
  'The Bridge Encampment',
  'Oriath Docks',
];

// Hideout zones
export const hideoutZones: string[] = [
  'Hideout',
  'Coastal Hideout',
  'Lush Hideout',
  'Unearthed Hideout',
  // Add more hideout names as needed
];

// Helper to check if a zone is a town
export function isTownZone(zoneName: string): boolean {
  return townZones.some(
    (town) => zoneName.toLowerCase().includes(town.toLowerCase())
  );
}

// Helper to check if a zone is a hideout
export function isHideoutZone(zoneName: string): boolean {
  return (
    zoneName.toLowerCase().includes('hideout') ||
    hideoutZones.some(
      (hideout) => zoneName.toLowerCase() === hideout.toLowerCase()
    )
  );
}

// Key breakpoints enabled for speedrun (act completions + important zones)
// Note: This list matches the breakpoints enabled by applySpeedrunPreset()
// (Kept as exported reference for documentation/tooling purposes)
export const speedrunEnabledBreakpoints = [
  // Act 1
  'The Coast',
  'The Upper Prison',
  'The Cavern of Anger',
  // Act 2
  'The Forest Encampment',
  'The Chamber of Sins 1',
  'The Ancient Pyramid',
  // Act 3
  'The Sarn Encampment',
  'The Upper Sceptre of God',
  // Act 4
  'Highgate (A4)',
  'The Harvest',
  // Act 5
  'Overseer Tower',
  'The Cathedral Rooftop',
  // Act 6
  'Lioneyes Watch (A6)',
  'The Brine King Reef',
  // Act 7
  'The Bridge Encampment',
  'The Temple of Decay 2',
  // Act 8
  'The Sarn Encampment (A8)',
  'The Harbour Bridge',
  // Act 9
  'Highgate (A9)',
  'The Belly of the Beast (A9)',
  // Act 10
  'Oriath Docks',
  'The Feeding Trough',
] as const;

// Act 1 speedrun order (Tidal Island after Mud Flats and Submerged Passage)
// This is for reference on typical speedrun routing

// Preset functions for quick configuration
export function applySpeedrunPreset(breakpoints: Breakpoint[]): Breakpoint[] {
  return breakpoints.map((bp) => ({
    ...bp,
    isEnabled: speedrunEnabledBreakpoints.includes(bp.name as typeof speedrunEnabledBreakpoints[number]),
  }));
}

export function applyMinimalPreset(breakpoints: Breakpoint[]): Breakpoint[] {
  // Only act transitions
  return breakpoints.map((bp) => ({
    ...bp,
    isEnabled: bp.type === 'act',
  }));
}

export function applyTownsOnlyPreset(breakpoints: Breakpoint[]): Breakpoint[] {
  // Only town zones
  return breakpoints.map((bp) => ({
    ...bp,
    isEnabled: bp.type === 'act',
  }));
}

export function resetToDefault(): Breakpoint[] {
  return JSON.parse(JSON.stringify(defaultBreakpoints));
}
