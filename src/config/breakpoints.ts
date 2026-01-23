import type { Breakpoint } from '../types';

// Default speedrun breakpoints for Path of Exile Acts 1-10
export const defaultBreakpoints: Breakpoint[] = [
  // Act 1
  { name: 'The Coast', type: 'zone', trigger: { type: 'zone', zoneName: 'The Coast', act: 1 }, isEnabled: true },
  { name: 'The Prison', type: 'zone', trigger: { type: 'zone', zoneName: 'The Upper Prison', act: 1 }, isEnabled: true },
  { name: 'Merveil Defeated', type: 'boss', trigger: { type: 'zone', zoneName: "The Cavern of Anger", act: 1 }, isEnabled: true },

  // Act 2
  { name: 'Act 2 Town', type: 'act', trigger: { type: 'zone', zoneName: 'The Forest Encampment', act: 2 }, isEnabled: true },
  { name: 'Chamber of Sins', type: 'zone', trigger: { type: 'zone', zoneName: 'The Chamber of Sins Level 1', act: 2 }, isEnabled: true },
  { name: 'Vaal Ruins', type: 'zone', trigger: { type: 'zone', zoneName: 'The Ancient Pyramid', act: 2 }, isEnabled: true },

  // Act 3
  { name: 'Act 3 Town', type: 'act', trigger: { type: 'zone', zoneName: 'The Sarn Encampment', act: 3 }, isEnabled: true },
  { name: 'The Docks', type: 'zone', trigger: { type: 'zone', zoneName: 'The Docks', act: 3 }, isEnabled: true },
  { name: 'Dominus Defeated', type: 'boss', trigger: { type: 'zone', zoneName: 'The Sceptre of God', act: 3 }, isEnabled: true },

  // Act 4
  { name: 'Act 4 Town', type: 'act', trigger: { type: 'zone', zoneName: 'Highgate', act: 4 }, isEnabled: true },
  { name: 'Kaom/Daresso', type: 'zone', trigger: { type: 'zone', zoneName: 'The Belly of the Beast Level 1', act: 4 }, isEnabled: true },
  { name: 'Malachai Defeated', type: 'boss', trigger: { type: 'zone', zoneName: 'The Harvest', act: 4 }, isEnabled: true },

  // Act 5
  { name: 'Act 5 Town', type: 'act', trigger: { type: 'zone', zoneName: 'Overseer\'s Tower', act: 5 }, isEnabled: true },
  { name: 'Kitava Act 5', type: 'boss', trigger: { type: 'zone', zoneName: 'The Cathedral Rooftop', act: 5 }, isEnabled: true },

  // Act 6
  { name: 'Act 6 Town', type: 'act', trigger: { type: 'zone', zoneName: 'Lioneye\'s Watch', act: 6 }, isEnabled: true },
  { name: 'The Brine King', type: 'boss', trigger: { type: 'zone', zoneName: 'The Brine King\'s Reef', act: 6 }, isEnabled: true },

  // Act 7
  { name: 'Act 7 Town', type: 'act', trigger: { type: 'zone', zoneName: 'The Bridge Encampment', act: 7 }, isEnabled: true },
  { name: 'Arakaali Defeated', type: 'boss', trigger: { type: 'zone', zoneName: "The Temple of Decay Level 2", act: 7 }, isEnabled: true },

  // Act 8
  { name: 'Act 8 Town', type: 'act', trigger: { type: 'zone', zoneName: 'The Sarn Encampment', act: 8 }, isEnabled: true },
  { name: 'Doedre Defeated', type: 'boss', trigger: { type: 'zone', zoneName: 'The Quay', act: 8 }, isEnabled: true },

  // Act 9
  { name: 'Act 9 Town', type: 'act', trigger: { type: 'zone', zoneName: 'Highgate', act: 9 }, isEnabled: true },
  { name: 'The Quarry', type: 'zone', trigger: { type: 'zone', zoneName: 'The Quarry', act: 9 }, isEnabled: true },

  // Act 10
  { name: 'Act 10 Town', type: 'act', trigger: { type: 'zone', zoneName: 'Oriath Docks', act: 10 }, isEnabled: true },
  { name: 'Kitava Final', type: 'boss', trigger: { type: 'zone', zoneName: 'The Feeding Trough', act: 10 }, isEnabled: true },

  // Level milestones
  { name: 'Level 10', type: 'level', trigger: { type: 'level', level: 10 }, isEnabled: false },
  { name: 'Level 20', type: 'level', trigger: { type: 'level', level: 20 }, isEnabled: false },
  { name: 'Level 30', type: 'level', trigger: { type: 'level', level: 30 }, isEnabled: false },
  { name: 'Level 40', type: 'level', trigger: { type: 'level', level: 40 }, isEnabled: false },
  { name: 'Level 50', type: 'level', trigger: { type: 'level', level: 50 }, isEnabled: false },
  { name: 'Level 60', type: 'level', trigger: { type: 'level', level: 60 }, isEnabled: false },
  { name: 'Level 70', type: 'level', trigger: { type: 'level', level: 70 }, isEnabled: false },

  // Lab completions
  { name: 'Normal Lab', type: 'lab', trigger: { type: 'zone', zoneName: "Aspirant's Plaza" }, isEnabled: false },
  { name: 'Cruel Lab', type: 'lab', trigger: { type: 'zone', zoneName: "Aspirant's Plaza" }, isEnabled: false },
  { name: 'Merciless Lab', type: 'lab', trigger: { type: 'zone', zoneName: "Aspirant's Plaza" }, isEnabled: false },
  { name: 'Uber Lab', type: 'lab', trigger: { type: 'zone', zoneName: "Aspirant's Plaza" }, isEnabled: false },
];

// Zone name to act mapping for disambiguation
export const zoneActMapping: Record<string, number[]> = {
  "Lioneye's Watch": [1, 6],
  "The Forest Encampment": [2],
  "The Sarn Encampment": [3, 8],
  "Highgate": [4, 9],
  "Overseer's Tower": [5],
  "The Bridge Encampment": [7],
  "Oriath Docks": [10],
  "Oriath": [5, 10],
};

// Boss zones for act completion detection
export const bossZones: Record<string, { boss: string; act: number }> = {
  "The Cavern of Anger": { boss: "Merveil", act: 1 },
  "The Ancient Pyramid": { boss: "Vaal Oversoul", act: 2 },
  "The Sceptre of God": { boss: "Dominus", act: 3 },
  "The Harvest": { boss: "Malachai", act: 4 },
  "The Cathedral Rooftop": { boss: "Kitava", act: 5 },
  "The Brine King's Reef": { boss: "The Brine King", act: 6 },
  "The Temple of Decay Level 2": { boss: "Arakaali", act: 7 },
  "The Quay": { boss: "Doedre, Maligaro, Shavronne", act: 8 },
  "The Quarry": { boss: "Depraved Trinity", act: 9 },
  "The Feeding Trough": { boss: "Kitava", act: 10 },
};
