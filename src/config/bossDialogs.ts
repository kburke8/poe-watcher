interface BossDialogTrigger {
  npcName: string;
  bossName: string;
  requiredZones?: string[];
}

export const bossDialogTriggers: BossDialogTrigger[] = [
  { npcName: 'Brutus, the Warden', bossName: 'Brutus', requiredZones: ['The Upper Prison'] },
  { npcName: 'Merveil', bossName: 'Merveil', requiredZones: ['The Cavern of Wrath'] },
];

export function getBossFromDialog(npcName: string, currentZone: string | null): string | null {
  for (const trigger of bossDialogTriggers) {
    if (trigger.npcName !== npcName) continue;

    if (trigger.requiredZones) {
      if (!currentZone) continue;
      const match = trigger.requiredZones.some(
        (z) => z.toLowerCase() === currentZone.toLowerCase()
      );
      if (!match) continue;
    }

    return trigger.bossName;
  }
  return null;
}
