interface BossDialogTrigger {
  npcName: string;
  bossName: string;
  requiredZones?: string[];
  /** If set, dialog text must start with this string (case-insensitive) */
  dialogStartsWith?: string;
}

export const bossDialogTriggers: BossDialogTrigger[] = [
  { npcName: 'Brutus, the Warden', bossName: 'Brutus', requiredZones: ['The Upper Prison'] },
  { npcName: 'Merveil', bossName: 'Merveil', requiredZones: ['The Cavern of Anger'], dialogStartsWith: 'This is love' },
  { npcName: 'Piety', bossName: 'Piety', requiredZones: ['The Crematorium', 'The Lunaris Temple Level 2'] },
  { npcName: 'Dominus', bossName: 'Dominus', requiredZones: ['The Upper Sceptre of God'] },
  { npcName: 'Daresso', bossName: 'Daresso', requiredZones: ['The Grand Arena'] },
  { npcName: 'King Kaom', bossName: 'King Kaom', requiredZones: ["Kaom's Stronghold"] },
  { npcName: 'Malachai', bossName: 'Malachai', requiredZones: ['The Harvest'] },
  { npcName: 'Avarius', bossName: 'Innocence', requiredZones: ['The Chamber of Innocence'] },
  { npcName: 'Tukohama', bossName: 'Tukohama', requiredZones: ['The Karui Fortress'] },
  { npcName: 'Nessa', bossName: 'The Brine King', requiredZones: ["The Brine King's Reef"] },
  { npcName: 'Silk', bossName: 'Arakaali', requiredZones: ['The Temple of Decay Level 2'] },
];

export function getBossFromDialog(npcName: string, currentZone: string | null, dialogText?: string): string | null {
  for (const trigger of bossDialogTriggers) {
    if (trigger.npcName !== npcName) continue;

    if (trigger.requiredZones) {
      if (!currentZone) continue;
      const match = trigger.requiredZones.some(
        (z) => z.toLowerCase() === currentZone.toLowerCase()
      );
      if (!match) continue;
    }

    if (trigger.dialogStartsWith) {
      if (!dialogText) continue;
      if (!dialogText.toLowerCase().startsWith(trigger.dialogStartsWith.toLowerCase())) continue;
    }

    return trigger.bossName;
  }
  return null;
}
