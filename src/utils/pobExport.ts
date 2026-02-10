import pako from 'pako';
import { invoke } from '@tauri-apps/api/core';
import type { PoeItem, Snapshot, Run, Split } from '../types';
import { defaultBreakpoints } from '../config/breakpoints';

// ============================================================================
// PoB Config Auto-Population Helpers
// ============================================================================

/**
 * Get the act number from a zone name by looking up defaultBreakpoints
 */
function getActFromZone(zoneName: string): number | null {
  const bp = defaultBreakpoints.find(b => b.trigger.zoneName === zoneName);
  return bp?.trigger.act ?? null;
}

/**
 * Get resistance penalty value for PoB based on act progression
 * - Act 1-5: No penalty (0)
 * - Act 6-10: -30% penalty (1) - after first Kitava fight
 * - Post-Act 10: -60% penalty (2) - after second Kitava fight
 */
function getResistancePenalty(act: number | null): number {
  if (!act || act <= 5) return 0;  // No penalty
  if (act <= 10) return 1;          // -30% (Act 5 Kitava penalty)
  return 2;                          // -60% (Act 10 Kitava penalty)
}

/**
 * Determine bandit selection based on zone progression
 * Default to "Alira" for any snapshot past Act 2 bandit quest area
 * Alira gives: +5 mana regen, +20% crit multi, +15% all res
 */
function getBanditForZone(zoneName: string, act: number | null): string {
  // Bandit quest completes in Act 2 after killing all 3 or helping one
  // "The Vaal Ruins" and beyond are after the bandit quest area
  const postBanditZones = ['The Vaal Ruins', 'The Wetlands', 'The Western Forest', 'The Northern Forest', 'The Caverns', 'The Ancient Pyramid'];

  if (act && act >= 3) return 'Alira';
  if (postBanditZones.includes(zoneName)) return 'Alira';

  return 'None';
}

/**
 * Gem name patterns that imply certain config flags should be enabled
 */
const gemConfigMap: Record<string, { name: string; type: 'boolean' | 'number' | 'string'; value: string }> = {
  // Frenzy charge generators
  'Blood Rage': { name: 'useFrenzyCharges', type: 'boolean', value: 'true' },
  'Frenzy': { name: 'useFrenzyCharges', type: 'boolean', value: 'true' },
  // Power charge generators
  'Power Charge On Critical': { name: 'usePowerCharges', type: 'boolean', value: 'true' },
  'Power Charge on Critical Support': { name: 'usePowerCharges', type: 'boolean', value: 'true' },
  'Assassin\'s Mark': { name: 'usePowerCharges', type: 'boolean', value: 'true' },
  // Endurance charge generators
  'Enduring Cry': { name: 'useEnduranceCharges', type: 'boolean', value: 'true' },
  'Endurance Charge on Melee Stun Support': { name: 'useEnduranceCharges', type: 'boolean', value: 'true' },
  // Onslaught
  'Onslaught Support': { name: 'conditionOnslaught', type: 'boolean', value: 'true' },
  // Culling Strike
  'Culling Strike Support': { name: 'conditionCullingStrike', type: 'boolean', value: 'true' },
  // Fortify
  'Fortify Support': { name: 'conditionFortify', type: 'boolean', value: 'true' },
  // Arcane Surge
  'Arcane Surge Support': { name: 'conditionArcaneSurge', type: 'boolean', value: 'true' },
  // Infusion
  'Infused Channelling Support': { name: 'conditionInfusion', type: 'boolean', value: 'true' },
  // Rage
  'Berserk': { name: 'conditionHaveRage', type: 'boolean', value: 'true' },
  'Rage Support': { name: 'conditionHaveRage', type: 'boolean', value: 'true' },
};

/**
 * Infer configuration flags from equipped gems
 */
function inferConfigFromGems(items: PoeItem[]): Record<string, { type: 'boolean' | 'number' | 'string'; value: string }> {
  const config: Record<string, { type: 'boolean' | 'number' | 'string'; value: string }> = {};

  // Collect all gem names from socketed items
  const allGems = items.flatMap(item =>
    item.socketedItems?.map(g => g.typeLine) ?? []
  );

  // Check each gem against our config map
  for (const gemName of allGems) {
    if (!gemName) continue;

    // Direct match
    if (gemConfigMap[gemName]) {
      const { name, type, value } = gemConfigMap[gemName];
      config[name] = { type, value };
      continue;
    }

    // Partial match for gem variations (e.g., transfigured gems)
    for (const [pattern, configEntry] of Object.entries(gemConfigMap)) {
      if (gemName.includes(pattern) || pattern.includes(gemName.replace(/ Support$/, ''))) {
        config[configEntry.name] = { type: configEntry.type, value: configEntry.value };
      }
    }
  }

  return config;
}

/**
 * Generate Config Input XML elements for a snapshot
 */
function generateConfigInputs(
  items: PoeItem[],
  zoneName: string | undefined,
  act: number | null
): string {
  const inputs: string[] = [];

  // Resistance penalty based on act
  const penalty = getResistancePenalty(act);
  inputs.push(`\t\t\t<Input name="resistancePenalty" number="${penalty}"/>`);

  // Bandit selection
  const bandit = getBanditForZone(zoneName || '', act);
  if (bandit !== 'None') {
    inputs.push(`\t\t\t<Input name="bandit" string="${bandit}"/>`);
  }

  // Infer config from equipped gems
  const gemConfig = inferConfigFromGems(items);
  for (const [name, { type, value }] of Object.entries(gemConfig)) {
    if (type === 'boolean') {
      inputs.push(`\t\t\t<Input name="${name}" boolean="${value}"/>`);
    } else if (type === 'number') {
      inputs.push(`\t\t\t<Input name="${name}" number="${value}"/>`);
    } else {
      inputs.push(`\t\t\t<Input name="${name}" string="${value}"/>`);
    }
  }

  return inputs.join('\n');
}

interface BuildData {
  items: PoeItem[];
  passives: { hashes: number[]; hashesEx: number[] };
  character: {
    level: number;
    class: string;
    ascendancy?: string;
  };
}

/**
 * Generate PoB-compatible XML from snapshot data
 */
function generatePobXml(data: BuildData): string {
  const { items, passives, character } = data;

  // Filter to only equipped items (not stash)
  const equippedItems = items.filter(
    (item) => item.inventoryId && !item.inventoryId.startsWith('Stash')
  );

  // Generate items section with proper PoB format
  const itemsXml: string[] = [];
  const slotItemMap: Record<string, number> = {};

  // Map inventory IDs to PoB slot names
  const slotNameMap: Record<string, string> = {
    Weapon: 'Weapon 1',
    Weapon2: 'Weapon 1 Swap',
    Offhand: 'Weapon 2',
    Offhand2: 'Weapon 2 Swap',
    Helm: 'Helmet',
    BodyArmour: 'Body Armour',
    Gloves: 'Gloves',
    Boots: 'Boots',
    Belt: 'Belt',
    Amulet: 'Amulet',
    Ring: 'Ring 1',
    Ring2: 'Ring 2',
    Flask: 'Flask 1',
    Flask2: 'Flask 2',
    Flask3: 'Flask 3',
    Flask4: 'Flask 4',
    Flask5: 'Flask 5',
  };

  equippedItems.forEach((item, index) => {
    const itemId = index + 1;
    const itemText = formatItemForPob(item);

    // Log first item to debug format
    if (index === 0) {
      console.log('[PoB Export] Sample item text:\n' + itemText);
      console.log('[PoB Export] Item properties:', item.properties);
    }

    // Count mods for ModRange elements (pobb.in uses these for display)
    const modCount = (item.implicitMods?.length || 0) + (item.explicitMods?.length || 0);
    const modRanges = Array.from({ length: modCount }, (_, i) =>
      `\t\t\t<ModRange range="0.5" id="${i + 1}"/>`
    ).join('\n');

    const itemXml = modRanges
      ? `\t\t<Item id="${itemId}">\n${itemText}\n${modRanges}\n\t\t</Item>`
      : `\t\t<Item id="${itemId}">\n${itemText}\n\t\t</Item>`;
    itemsXml.push(itemXml);

    // Build slot mapping
    let slotName = slotNameMap[item.inventoryId];

    // Handle flasks - POE API returns "Flask" for all, use x coordinate to determine slot
    if (item.inventoryId === 'Flask' && item.x !== undefined && item.x !== null) {
      const flaskSlot = item.x + 1; // x is 0-indexed, slots are 1-indexed
      slotName = `Flask ${flaskSlot}`;
    }

    console.log(`[PoB Export] Item ${itemId}: ${item.typeLine} in slot ${item.inventoryId} (x=${item.x}) -> ${slotName || 'unmapped'}`);
    if (slotName) {
      slotItemMap[slotName] = itemId;
    }
  });

  // Generate ItemSet with all possible slots (required for pobb.in)
  const allSlots = generateItemSetSlots(slotItemMap);

  console.log(`[PoB Export] Generated ${itemsXml.length} items, ${Object.keys(slotItemMap).length} mapped slots`);

  // Generate skills from socketed gems
  const skillsXml = generateSkillsXml(equippedItems);

  // Generate tree - use comma-separated node IDs
  const treeNodes = passives.hashes.join(',');
  console.log(`[PoB Export] Passive tree: ${passives.hashes.length} nodes, first 5: ${passives.hashes.slice(0, 5).join(', ')}`);

  // Derive class from ascendancy if class is unknown
  const { class: className, ascendancy: ascendClassName } = deriveClassAndAscendancy(character.class, character.ascendancy);
  const classId = getClassId(className);
  const ascendId = getAscendancyId(ascendClassName);
  console.log(`[PoB Export] Class mapping: "${character.class}" -> className="${className}" (classId=${classId}), ascendancy="${ascendClassName}" (ascendClassId=${ascendId})`);

  // Build the XML - this format matches what PoB/pobb.in expects
  // Note: PoB Community Fork expects specific XML structure with ItemSet
  return `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
	<Build mainSocketGroup="1" className="${className}" ascendClassName="${ascendClassName}" pantheonMajorGod="None" pantheonMinorGod="None" characterLevelAutoMode="false" level="${character.level}" viewMode="ITEMS" targetVersion="3_0" bandit="None">
		<PlayerStat stat="Life" value="1000"/>
	</Build>
	<Import>
	</Import>
	<Calcs>
	</Calcs>
	<Items showStatDifferences="true" activeItemSet="1" useSecondWeaponSet="false">
${itemsXml.join('\n')}
		<ItemSet id="1" useSecondWeaponSet="false">
${allSlots}
		</ItemSet>
		<TradeSearchWeights/>
	</Items>
	<Skills defaultGemLevel="normalMaximum" defaultGemQuality="0" sortGemsByDPS="true" activeSkillSet="1">
${skillsXml || '\t\t<SkillSet id="1"/>'}
	</Skills>
	<Tree activeSpec="1">
		<Spec title="Default" classId="${classId}" ascendClassId="${getAscendancyId(character.ascendancy)}" treeVersion="3_27"${treeNodes ? ` nodes="${treeNodes}"` : ''}>
			<URL>https://www.pathofexile.com/passive-skill-tree/3.27.0/AAAA</URL>
			<Sockets></Sockets>
		</Spec>
	</Tree>
	<Notes>Exported from POE Watcher speedrun tracker</Notes>
</PathOfBuilding>`;
}

/**
 * Format a POE item for PoB import - must match PoB's expected text format exactly
 */
function formatItemForPob(item: PoeItem): string {
  const lines: string[] = [];

  // Rarity line - PoB/pobb.in expects uppercase RARE, UNIQUE, etc.
  const rarityNames = ['NORMAL', 'MAGIC', 'RARE', 'UNIQUE', 'GEM', 'CURRENCY', 'DIVINATION', 'QUEST', 'PROPHECY', 'FOIL'];
  const rarity = rarityNames[Math.min(item.frameType || 0, rarityNames.length - 1)];
  lines.push(`Rarity: ${rarity}`);

  // Name (for Rare/Unique items)
  if (item.name) {
    const cleanName = item.name.replace(/<<[^>]*>>/g, '').trim();
    if (cleanName) {
      lines.push(cleanName);
    }
  }

  // Base type
  if (item.typeLine) {
    lines.push(item.typeLine);
  }

  // Extract base stats from properties (Armour, Evasion, Energy Shield)
  // These must come BEFORE Unique ID for pobb.in compatibility
  if (item.properties && item.properties.length > 0) {
    const defenseStats: { name: string; value: string }[] = [];
    const baseStats = ['Armour', 'Evasion', 'Evasion Rating', 'Energy Shield', 'Ward'];

    item.properties.forEach((prop) => {
      if (baseStats.some(stat => prop.name.includes(stat)) && prop.values && prop.values.length > 0) {
        const value = String(prop.values[0][0]);
        // Normalize the property name
        let statName = prop.name;
        if (statName === 'Evasion Rating') statName = 'Evasion';
        defenseStats.push({ name: statName, value });
      }
    });

    // Add defense stats and their percentiles (pobb.in uses 0.5 as default)
    defenseStats.forEach(({ name, value }) => {
      lines.push(`${name}: ${value}`);
      lines.push(`${name}BasePercentile: 0.5`);
    });
  }

  // Unique ID - required for pobb.in item display
  if (item.id) {
    lines.push(`Unique ID: ${item.id}`);
  }

  // Item level
  if (item.ilvl) {
    lines.push(`Item Level: ${item.ilvl}`);
  }
  lines.push(`Quality: 0`);

  // Sockets
  if (item.sockets && item.sockets.length > 0) {
    const socketStr = formatSockets(item.sockets);
    if (socketStr) {
      lines.push(`Sockets: ${socketStr}`);
    }
  }

  // Level requirement - use a reasonable estimate
  const levelReq = item.ilvl ? Math.max(1, Math.min(item.ilvl - 10, 70)) : 1;
  lines.push(`LevelReq: ${levelReq}`);

  // Implicits count (always required) followed by implicit mods
  lines.push(`Implicits: ${item.implicitMods?.length || 0}`);
  if (item.implicitMods && item.implicitMods.length > 0) {
    item.implicitMods.forEach((mod) => {
      lines.push(mod);
    });
  }

  // Explicit mods
  if (item.explicitMods && item.explicitMods.length > 0) {
    item.explicitMods.forEach((mod) => {
      lines.push(mod);
    });
  }

  return lines.join('\n');
}

/**
 * Generate ItemSet slots XML - pobb.in requires all slots to be listed
 */
function generateItemSetSlots(slotItemMap: Record<string, number>): string {
  // All possible slot names that pobb.in expects
  const allSlotNames = [
    // Main equipment
    'Weapon 1', 'Weapon 2', 'Helmet', 'Body Armour', 'Gloves', 'Boots',
    'Belt', 'Amulet', 'Ring 1', 'Ring 2', 'Ring 3',
    // Flasks
    'Flask 1', 'Flask 2', 'Flask 3', 'Flask 4', 'Flask 5',
    // Swap weapons
    'Weapon 1 Swap', 'Weapon 2 Swap',
    // Grafts (new in PoE)
    'Graft 1', 'Graft 2',
    // Abyssal sockets - for each possible gear piece
    ...['Weapon 1', 'Weapon 2', 'Weapon 1 Swap', 'Weapon 2 Swap', 'Helmet', 'Body Armour', 'Gloves', 'Boots', 'Belt']
      .flatMap(slot => [1, 2, 3, 4, 5, 6].map(n => `${slot} Abyssal Socket ${n}`)),
  ];

  return allSlotNames
    .map(name => {
      const itemId = slotItemMap[name] || 0;
      return `\t\t\t<Slot itemId="${itemId}" name="${name}" itemPbURL=""/>`;
    })
    .join('\n');
}

/**
 * Format sockets for PoB
 */
function formatSockets(sockets: Array<{ group: number; attr: string }>): string {
  if (!sockets || sockets.length === 0) return '';

  // Group sockets by their link group
  const groups = new Map<number, string[]>();

  sockets.forEach((socket) => {
    const color = socketAttrToColor(socket.attr);
    if (!groups.has(socket.group)) {
      groups.set(socket.group, []);
    }
    groups.get(socket.group)!.push(color);
  });

  // Format: linked sockets joined with -, groups joined with space
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([, colors]) => colors.join('-'))
    .join(' ');
}

function socketAttrToColor(attr: string): string {
  const map: Record<string, string> = {
    S: 'R', // Strength = Red
    D: 'G', // Dexterity = Green
    I: 'B', // Intelligence = Blue
    G: 'W', // Generic = White
    A: 'A', // Abyss
    DV: 'W', // Delve?
  };
  return map[attr] || 'W';
}

/**
 * Generate skills XML from socketed items
 */
function generateSkillsXml(items: PoeItem[]): string {
  const skills: string[] = [];

  // Map inventory IDs to PoB skill slot names
  const skillSlotMap: Record<string, string> = {
    Weapon: 'Weapon 1',
    Weapon2: 'Weapon 1 Swap',
    Offhand: 'Weapon 2',
    Offhand2: 'Weapon 2 Swap',
    Helm: 'Helmet',
    BodyArmour: 'Body Armour',
    Gloves: 'Gloves',
    Boots: 'Boots',
    Belt: 'Belt',
    Amulet: 'Amulet',
    Ring: 'Ring 1',
    Ring2: 'Ring 2',
  };

  items.forEach((item) => {
    if (!item.socketedItems || item.socketedItems.length === 0) return;

    const gems = item.socketedItems
      .map((gem) => {
        let level = 20;
        let quality = 0;

        // Try to get level and quality from properties if available
        if (gem.properties && gem.properties.length > 0) {
          const levelProp = gem.properties.find((p: { name: string }) => p.name === 'Level');
          const qualityProp = gem.properties.find((p: { name: string }) => p.name === 'Quality');

          if (levelProp?.values?.[0]?.[0]) {
            level = parseInt(String(levelProp.values[0][0]).replace(/[^0-9]/g, ''), 10) || 20;
          }
          if (qualityProp?.values?.[0]?.[0]) {
            quality = parseInt(String(qualityProp.values[0][0]).replace(/[^0-9]/g, ''), 10) || 0;
          }
        }

        const gemName = gem.typeLine || 'Unknown Gem';
        const { skillId, gemId } = getGemIds(gemName);

        console.log(`[PoB Export] Gem: "${gemName}" level ${level} quality ${quality} skillId=${skillId}`);

        // Full gem format for pobb.in compatibility
        return `\t\t\t\t<Gem qualityId="Default" enabled="true" skillId="${skillId}" quality="${quality}" gemId="${gemId}" nameSpec="${escapeXml(gemName)}" level="${level}" enableGlobal1="true"/>`;
      });

    if (gems.length > 0) {
      const slotName = skillSlotMap[item.inventoryId] || item.inventoryId || 'Unknown';
      skills.push(
        `\t\t\t<Skill mainActiveSkill="1" enabled="true" slot="${slotName}">\n${gems.join('\n')}\n\t\t\t</Skill>`
      );
    }
  });

  // Wrap in SkillSet
  if (skills.length > 0) {
    return `\t\t<SkillSet id="1">\n${skills.join('\n')}\n\t\t</SkillSet>`;
  }
  return '';
}

/**
 * Get gem IDs from gem name for pobb.in compatibility
 */
function getGemIds(gemName: string): { skillId: string; gemId: string } {
  // Convert gem name to skillId format (PascalCase, no spaces)
  // e.g., "Assassin's Mark" -> "AssassinsMark"
  // e.g., "Lifetap Support" -> "SupportLifetap"

  const isSupport = gemName.includes('Support');
  const cleanName = gemName
    .replace(/ Support$/, '')
    .replace(/'/g, '')
    .replace(/\s+/g, '');

  let skillId: string;
  let gemId: string;

  if (isSupport) {
    skillId = `Support${cleanName}`;
    gemId = `Metadata/Items/Gems/SupportGem${cleanName}`;
  } else {
    skillId = cleanName;
    gemId = `Metadata/Items/Gems/SkillGem${cleanName}`;
  }

  // Handle some common special cases and transfigured gems
  const specialMappings: Record<string, { skillId: string; gemId: string }> = {
    // Standard gems
    "Assassin's Mark": { skillId: 'AssassinsMark', gemId: 'Metadata/Items/Gems/SkillGemCriticalWeakness' },
    "Herald of Ice": { skillId: 'HeraldOfIce', gemId: 'Metadata/Items/Gems/SkillGemHeraldOfIce' },
    "Blood Rage": { skillId: 'BloodRage', gemId: 'Metadata/Items/Gems/SkillGemBloodRage' },
    "Leap Slam": { skillId: 'LeapSlam', gemId: 'Metadata/Items/Gems/SkillGemLeapSlam' },
    "Steelskin": { skillId: 'QuickGuard', gemId: 'Metadata/Items/Gems/SkillGemSteelskin' },
    "Precision": { skillId: 'Precision', gemId: 'Metadata/Items/Gems/SkillGemPrecision' },
    "Wrath": { skillId: 'Wrath', gemId: 'Metadata/Items/Gems/SkillGemWrath' },
    "Frostblink": { skillId: 'Frostblink', gemId: 'Metadata/Items/Gems/SkillGemFrostblink' },
    "Lifetap Support": { skillId: 'SupportLifetap', gemId: 'Metadata/Items/Gems/SupportGemLifetap' },
    "Mark On Hit Support": { skillId: 'SupportMarkOnHit', gemId: 'Metadata/Items/Gems/SupportGemMarkOnHit' },
    "Faster Attacks Support": { skillId: 'SupportFasterAttacks', gemId: 'Metadata/Items/Gems/SupportGemFasterAttack' },
    "Momentum Support": { skillId: 'SupportMomentum', gemId: 'Metadata/Items/Gems/SupportGemOnslaught' },
    "Automation Support": { skillId: 'Automation', gemId: 'Metadata/Items/Gems/SkillGemAutomation' },
    "Empower Support": { skillId: 'SupportEmpower', gemId: 'Metadata/Items/Gems/SupportGemAdditionalLevel' },
    "Trinity Support": { skillId: 'SupportTrinity', gemId: 'Metadata/Items/Gems/SupportGemTrinity' },
    "Added Cold Damage Support": { skillId: 'SupportAddedColdDamage', gemId: 'Metadata/Items/Gems/SupportGemAddedColdDamage' },
    "Multistrike Support": { skillId: 'SupportMultistrike', gemId: 'Metadata/Items/Gems/SupportGemMultistrike' },
    "Volatility Support": { skillId: 'SupportVolatility', gemId: 'Metadata/Items/Gems/SupportGemVolatility' },
    // Transfigured gems - map to base gem with variant
    "Smite of Divine Judgement": { skillId: 'Smite', gemId: 'Metadata/Items/Gems/SkillGemSmite' },
  };

  if (specialMappings[gemName]) {
    return specialMappings[gemName];
  }

  return { skillId, gemId };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getClassId(className: string): number {
  const classIds: Record<string, number> = {
    Scion: 0,
    Marauder: 1,
    Ranger: 2,
    Witch: 3,
    Duelist: 4,
    Templar: 5,
    Shadow: 6,
  };
  return classIds[className] ?? 0; // Default to Scion (0) if unknown
}

function getAscendancyId(ascendancy: string | undefined): number {
  if (!ascendancy || ascendancy === 'None') return 0;

  // PoB ascendancy IDs - position within the class (1-indexed)
  // Order based on PoB Community Fork tree version 3.27
  // Note: Warden replaced Raider and takes position 1 for Ranger in PoB 3.27
  const ascendancyIds: Record<string, number> = {
    // Scion
    Ascendant: 1,
    // Marauder (Juggernaut=1, Berserker=2, Chieftain=3)
    Juggernaut: 1,
    Berserker: 2,
    Chieftain: 3,
    // Ranger in PoB 3.27 (Warden=1, Deadeye=2, Pathfinder=3)
    Warden: 1, // Warden replaced Raider and takes position 1
    Raider: 1, // Legacy - maps to same position as Warden
    Deadeye: 2,
    Pathfinder: 3,
    // Witch (Necromancer=1, Elementalist=2, Occultist=3)
    Necromancer: 1,
    Elementalist: 2,
    Occultist: 3,
    // Duelist (Slayer=1, Gladiator=2, Champion=3)
    Slayer: 1,
    Gladiator: 2,
    Champion: 3,
    // Templar (Inquisitor=1, Hierophant=2, Guardian=3)
    Inquisitor: 1,
    Hierophant: 2,
    Guardian: 3,
    // Shadow (Assassin=1, Saboteur=2, Trickster=3)
    Assassin: 1,
    Saboteur: 2,
    Trickster: 3,
  };

  const id = ascendancyIds[ascendancy];
  console.log(`[PoB Export] Ascendancy lookup: "${ascendancy}" -> ${id}`);
  return id ?? 0;
}

/**
 * Derive both class AND ascendancy from rawClass and ascendancy params
 * Handles the case where rawClass is actually an ascendancy name (from POE log)
 */
function deriveClassAndAscendancy(rawClass: string | undefined, ascendancy: string | undefined): { class: string; ascendancy: string } {
  const ascendancyToClass: Record<string, string> = {
    Ascendant: 'Scion',
    Juggernaut: 'Marauder', Berserker: 'Marauder', Chieftain: 'Marauder',
    Warden: 'Ranger', Raider: 'Ranger', Deadeye: 'Ranger', Pathfinder: 'Ranger',
    Necromancer: 'Witch', Elementalist: 'Witch', Occultist: 'Witch',
    Slayer: 'Duelist', Gladiator: 'Duelist', Champion: 'Duelist',
    Inquisitor: 'Templar', Hierophant: 'Templar', Guardian: 'Templar',
    Assassin: 'Shadow', Saboteur: 'Shadow', Trickster: 'Shadow',
  };

  const classMap: Record<string, string> = {
    Marauder: 'Marauder', Ranger: 'Ranger', Witch: 'Witch',
    Duelist: 'Duelist', Templar: 'Templar', Shadow: 'Shadow', Scion: 'Scion',
    Warrior: 'Marauder', Mercenary: 'Duelist', Huntress: 'Ranger',
    Monk: 'Templar', Sorceress: 'Witch', Druid: 'Witch',
  };

  // Case 1: rawClass is a base class name
  if (rawClass && rawClass !== 'Unknown' && classMap[rawClass]) {
    console.log(`[PoB Export] Case 1: rawClass "${rawClass}" is a base class`);
    return {
      class: classMap[rawClass],
      ascendancy: ascendancy || 'None'
    };
  }

  // Case 2: rawClass is actually an ascendancy name (from POE log)
  if (rawClass && ascendancyToClass[rawClass]) {
    console.log(`[PoB Export] Case 2: rawClass "${rawClass}" is an ascendancy -> class "${ascendancyToClass[rawClass]}"`);
    return {
      class: ascendancyToClass[rawClass],
      ascendancy: rawClass  // Use rawClass as the ascendancy
    };
  }

  // Case 3: Have ascendancy param, derive class from it
  if (ascendancy && ascendancyToClass[ascendancy]) {
    console.log(`[PoB Export] Case 3: Derived class from ascendancy param "${ascendancy}" -> "${ascendancyToClass[ascendancy]}"`);
    return {
      class: ascendancyToClass[ascendancy],
      ascendancy: ascendancy
    };
  }

  // Default
  console.log(`[PoB Export] Default: Could not derive class from rawClass="${rawClass}" or ascendancy="${ascendancy}"`);
  return { class: 'Scion', ascendancy: 'None' };
}

/**
 * Encode build data into a PoB import code
 */
export function encodePobCode(data: BuildData): string {
  const xml = generatePobXml(data);
  console.log('[PoB Export] Full XML:\n', xml);
  console.log('[PoB Export] XML length:', xml.length);

  // Compress with zlib (deflate)
  const compressed = pako.deflate(new TextEncoder().encode(xml), { level: 9 });

  // Base64 encode and make URL-safe
  const base64 = btoa(String.fromCharCode(...compressed));
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Create build data from a snapshot
 */
export function createBuildData(snapshot: Snapshot, run: Run): BuildData {
  let items: PoeItem[] = [];
  let passives = { hashes: [] as number[], hashesEx: [] as number[] };

  console.log('[PoB Export] Run data (full):', JSON.stringify(run, null, 2));
  console.log('[PoB Export] Run ascendancy value:', run.ascendancy, 'type:', typeof run.ascendancy);

  try {
    items = JSON.parse(snapshot.itemsJson || '[]');
    console.log('[PoB Export] Parsed items:', items.length);
    // Log all inventory IDs and x positions to see what slots are present
    const itemSlots = items.map((i: PoeItem) => ({ inv: i.inventoryId, x: i.x, name: i.typeLine }));
    console.log('[PoB Export] Item slots found:', itemSlots);
    // Log first item to verify structure
    if (items[0]) {
      console.log('[PoB Export] Sample item:', JSON.stringify(items[0], null, 2).substring(0, 500));
    }
  } catch (e) {
    console.error('[PoB Export] Failed to parse items JSON:', e);
  }

  try {
    const passiveData = JSON.parse(snapshot.passiveTreeJson || '{}');
    passives = {
      hashes: passiveData.hashes || [],
      hashesEx: passiveData.hashes_ex || passiveData.hashesEx || [],
    };
    console.log('[PoB Export] Parsed passives:', passives.hashes.length, 'nodes');
  } catch (e) {
    console.error('[PoB Export] Failed to parse passives JSON:', e);
  }

  const buildData = {
    items,
    passives,
    character: {
      level: snapshot.characterLevel,
      class: run.class,
      ascendancy: run.ascendancy || undefined,
    },
  };

  console.log('[PoB Export] Build data character:', buildData.character);

  return buildData;
}

/**
 * Copy PoB code to clipboard
 */
export async function exportToPob(snapshot: Snapshot, run: Run): Promise<void> {
  const buildData = createBuildData(snapshot, run);
  const code = encodePobCode(buildData);
  console.log('[PoB Export] Code length:', code.length);
  await navigator.clipboard.writeText(code);
}

/**
 * Upload to pobb.in and return the share URL
 * Note: pobb.in may not have a public API - this uses the Tauri backend to avoid CORS
 */
export async function shareOnPobbIn(snapshot: Snapshot, run: Run): Promise<string> {
  const buildData = createBuildData(snapshot, run);
  const code = encodePobCode(buildData);

  // Use Tauri command to bypass CORS
  const result = await invoke<{ url: string }>('upload_to_pobbin', { pobCode: code });
  return result.url;
}

// ============================================================================
// Multi-Snapshot Export Functions
// ============================================================================

interface MultiBuildData {
  snapshots: Array<{
    snapshot: Snapshot;
    items: PoeItem[];
    passives: { hashes: number[]; hashesEx: number[] };
    label: string; // e.g., "Act 5 - Level 42"
    zoneName?: string; // Zone name for config inference
  }>;
  character: {
    level: number;
    class: string;
    ascendancy?: string;
  };
}

/**
 * Generate PoB-compatible XML from multiple snapshots
 * Each snapshot becomes a separate ItemSet/SkillSet/Spec
 */
function generateMultiSnapshotPobXml(data: MultiBuildData): string {
  const { snapshots, character } = data;

  // Derive class from ascendancy if class is unknown
  const { class: className, ascendancy: ascendClassName } = deriveClassAndAscendancy(character.class, character.ascendancy);
  const classId = getClassId(className);
  const ascendId = getAscendancyId(ascendClassName);

  // Use the latest snapshot's level
  const latestLevel = snapshots.length > 0 ? snapshots[snapshots.length - 1].snapshot.characterLevel : character.level;

  // Collect all unique items across all snapshots
  const allItemsMap = new Map<string, { item: PoeItem; id: number }>();
  let nextItemId = 1;

  // Generate ItemSets (one per snapshot)
  const itemSetsXml: string[] = [];

  for (let setIdx = 0; setIdx < snapshots.length; setIdx++) {
    const { items, label } = snapshots[setIdx];
    const setId = setIdx + 1;
    const slotItemMap: Record<string, number> = {};

    // Map inventory IDs to PoB slot names
    const slotNameMap: Record<string, string> = {
      Weapon: 'Weapon 1', Weapon2: 'Weapon 1 Swap', Offhand: 'Weapon 2', Offhand2: 'Weapon 2 Swap',
      Helm: 'Helmet', BodyArmour: 'Body Armour', Gloves: 'Gloves', Boots: 'Boots',
      Belt: 'Belt', Amulet: 'Amulet', Ring: 'Ring 1', Ring2: 'Ring 2',
      Flask: 'Flask 1', Flask2: 'Flask 2', Flask3: 'Flask 3', Flask4: 'Flask 4', Flask5: 'Flask 5',
    };

    const equippedItems = items.filter(item => item.inventoryId && !item.inventoryId.startsWith('Stash'));

    equippedItems.forEach((item) => {
      // Create unique key for item (use ID or generate one from properties)
      const itemKey = item.id || `${item.typeLine}-${item.inventoryId}-${setIdx}`;

      if (!allItemsMap.has(itemKey)) {
        allItemsMap.set(itemKey, { item, id: nextItemId++ });
      }

      const itemId = allItemsMap.get(itemKey)!.id;
      let slotName = slotNameMap[item.inventoryId];

      // Handle flasks
      if (item.inventoryId === 'Flask' && item.x !== undefined && item.x !== null) {
        slotName = `Flask ${item.x + 1}`;
      }

      if (slotName) {
        slotItemMap[slotName] = itemId;
      }
    });

    const slotsXml = generateItemSetSlots(slotItemMap);
    itemSetsXml.push(`\t\t<ItemSet id="${setId}" useSecondWeaponSet="false" title="${escapeXml(label)}">\n${slotsXml}\n\t\t</ItemSet>`);
  }

  // Generate Items XML (all unique items)
  const itemsXml: string[] = [];
  for (const { item, id } of allItemsMap.values()) {
    const itemText = formatItemForPob(item);
    const modCount = (item.implicitMods?.length || 0) + (item.explicitMods?.length || 0);
    const modRanges = Array.from({ length: modCount }, (_, i) =>
      `\t\t\t<ModRange range="0.5" id="${i + 1}"/>`
    ).join('\n');
    const itemXml = modRanges
      ? `\t\t<Item id="${id}">\n${itemText}\n${modRanges}\n\t\t</Item>`
      : `\t\t<Item id="${id}">\n${itemText}\n\t\t</Item>`;
    itemsXml.push(itemXml);
  }

  // Generate SkillSets (one per snapshot) with matching titles for Loadouts
  const skillSetsXml: string[] = [];
  for (let setIdx = 0; setIdx < snapshots.length; setIdx++) {
    const { items, label } = snapshots[setIdx];
    const setId = setIdx + 1;
    const equippedItems = items.filter(item => item.inventoryId && !item.inventoryId.startsWith('Stash'));
    const skillsContent = generateSkillsXmlContent(equippedItems);
    if (skillsContent) {
      skillSetsXml.push(`\t\t<SkillSet id="${setId}" title="${escapeXml(label)}">\n${skillsContent}\n\t\t</SkillSet>`);
    } else {
      skillSetsXml.push(`\t\t<SkillSet id="${setId}" title="${escapeXml(label)}"/>`);
    }
  }

  // Generate Tree Specs (one per snapshot)
  const specsXml: string[] = [];
  for (let setIdx = 0; setIdx < snapshots.length; setIdx++) {
    const { passives, label } = snapshots[setIdx];
    const treeNodes = passives.hashes.join(',');
    specsXml.push(`\t\t<Spec title="${escapeXml(label)}" classId="${classId}" ascendClassId="${ascendId}" treeVersion="3_27"${treeNodes ? ` nodes="${treeNodes}"` : ''}>
\t\t\t<URL>https://www.pathofexile.com/passive-skill-tree/3.27.0/AAAA</URL>
\t\t\t<Sockets></Sockets>
\t\t</Spec>`);
  }

  // Generate ConfigSets (one per snapshot) with matching titles for Loadouts
  // Each ConfigSet is populated with resistance penalty, bandit, and gem-inferred settings
  const configSetsXml: string[] = [];
  for (let setIdx = 0; setIdx < snapshots.length; setIdx++) {
    const { items, label, zoneName } = snapshots[setIdx];
    const setId = setIdx + 1;
    const equippedItems = items.filter(item => item.inventoryId && !item.inventoryId.startsWith('Stash'));

    // Look up act from zone name for config inference
    const act = zoneName ? getActFromZone(zoneName) : null;
    const configInputs = generateConfigInputs(equippedItems, zoneName, act);

    if (configInputs) {
      configSetsXml.push(`\t\t<ConfigSet id="${setId}" title="${escapeXml(label)}">\n${configInputs}\n\t\t</ConfigSet>`);
    } else {
      configSetsXml.push(`\t\t<ConfigSet id="${setId}" title="${escapeXml(label)}"/>`);
    }
  }

  // Default to the last snapshot (most recent/end of run state)
  const defaultSet = snapshots.length;

  return `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
	<Build mainSocketGroup="1" className="${className}" ascendClassName="${ascendClassName}" pantheonMajorGod="None" pantheonMinorGod="None" characterLevelAutoMode="false" level="${latestLevel}" viewMode="ITEMS" targetVersion="3_0" bandit="None">
		<PlayerStat stat="Life" value="1000"/>
	</Build>
	<Import>
	</Import>
	<Calcs>
	</Calcs>
	<Items showStatDifferences="true" activeItemSet="${defaultSet}" useSecondWeaponSet="false">
${itemsXml.join('\n')}
${itemSetsXml.join('\n')}
		<TradeSearchWeights/>
	</Items>
	<Skills defaultGemLevel="normalMaximum" defaultGemQuality="0" sortGemsByDPS="true" activeSkillSet="${defaultSet}">
${skillSetsXml.join('\n')}
	</Skills>
	<Tree activeSpec="${defaultSet}">
${specsXml.join('\n')}
	</Tree>
	<Config activeConfigSet="${defaultSet}">
${configSetsXml.join('\n')}
	</Config>
	<Notes>Exported from POE Watcher speedrun tracker - ${snapshots.length} snapshots</Notes>
</PathOfBuilding>`;
}

/**
 * Helper to generate skills XML content without wrapper
 */
function generateSkillsXmlContent(items: PoeItem[]): string {
  const skillSlotMap: Record<string, string> = {
    Weapon: 'Weapon 1', Weapon2: 'Weapon 1 Swap', Offhand: 'Weapon 2', Offhand2: 'Weapon 2 Swap',
    Helm: 'Helmet', BodyArmour: 'Body Armour', Gloves: 'Gloves', Boots: 'Boots',
    Belt: 'Belt', Amulet: 'Amulet', Ring: 'Ring 1', Ring2: 'Ring 2',
  };

  const skills: string[] = [];

  items.forEach((item) => {
    if (!item.socketedItems || item.socketedItems.length === 0) return;

    const gems = item.socketedItems.map((gem) => {
      let level = 20;
      let quality = 0;

      if (gem.properties && gem.properties.length > 0) {
        const levelProp = gem.properties.find((p: { name: string }) => p.name === 'Level');
        const qualityProp = gem.properties.find((p: { name: string }) => p.name === 'Quality');
        if (levelProp?.values?.[0]?.[0]) level = parseInt(String(levelProp.values[0][0]).replace(/[^0-9]/g, ''), 10) || 20;
        if (qualityProp?.values?.[0]?.[0]) quality = parseInt(String(qualityProp.values[0][0]).replace(/[^0-9]/g, ''), 10) || 0;
      }

      const gemName = gem.typeLine || 'Unknown Gem';
      const { skillId, gemId } = getGemIds(gemName);

      return `\t\t\t\t<Gem qualityId="Default" enabled="true" skillId="${skillId}" quality="${quality}" gemId="${gemId}" nameSpec="${escapeXml(gemName)}" level="${level}" enableGlobal1="true"/>`;
    });

    if (gems.length > 0) {
      const slotName = skillSlotMap[item.inventoryId] || item.inventoryId || 'Unknown';
      skills.push(`\t\t\t<Skill mainActiveSkill="1" enabled="true" slot="${slotName}">\n${gems.join('\n')}\n\t\t\t</Skill>`);
    }
  });

  return skills.join('\n');
}

/**
 * Create multi-snapshot build data
 */
export function createMultiBuildData(snapshots: Snapshot[], run: Run, splits?: Split[]): MultiBuildData {
  console.log('[PoB Multi-Export] Run data:', {
    class: run.class,
    ascendancy: run.ascendancy,
    characterName: run.characterName,
  });

  // Build a map of splitId -> breakpointName for quick lookup
  const splitMap = new Map<number, string>();
  if (splits) {
    for (const split of splits) {
      splitMap.set(split.id, split.breakpointName);
    }
  }

  const snapshotData = snapshots.map((snapshot, idx) => {
    let items: PoeItem[] = [];
    let passives = { hashes: [] as number[], hashesEx: [] as number[] };

    try {
      items = JSON.parse(snapshot.itemsJson || '[]');
    } catch (e) {
      console.error('[PoB Multi-Export] Failed to parse items:', e);
    }

    try {
      const passiveData = JSON.parse(snapshot.passiveTreeJson || '{}');
      passives = {
        hashes: passiveData.hashes || [],
        hashesEx: passiveData.hashes_ex || passiveData.hashesEx || [],
      };
      console.log(`[PoB Multi-Export] Snapshot ${idx + 1} passives: ${passives.hashes.length} nodes`);
    } catch (e) {
      console.error('[PoB Multi-Export] Failed to parse passives:', e);
    }

    // Create label: "Zone Name - Level X [MM:SS]" or fallback to time-based
    const timeStr = formatTimeForLabel(snapshot.elapsedTimeMs);
    const zoneName = splitMap.get(snapshot.splitId);
    const label = zoneName
      ? `${zoneName} - Level ${snapshot.characterLevel} [${timeStr}]`
      : `${timeStr} - Level ${snapshot.characterLevel}`;

    // Include zoneName separately for config inference
    return { snapshot, items, passives, label, zoneName };
  });

  const ascendancy = run.ascendancy || undefined;
  console.log('[PoB Multi-Export] Using ascendancy:', ascendancy, 'class:', run.class);

  return {
    snapshots: snapshotData,
    character: {
      level: snapshotData[snapshotData.length - 1]?.snapshot.characterLevel || 1,
      class: run.class,
      ascendancy: ascendancy,
    },
  };
}

function formatTimeForLabel(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Encode multi-snapshot build data into a PoB import code
 */
export function encodeMultiPobCode(data: MultiBuildData): string {
  const xml = generateMultiSnapshotPobXml(data);
  console.log('[PoB Multi-Export] Full XML length:', xml.length);
  const compressed = pako.deflate(new TextEncoder().encode(xml), { level: 9 });
  const base64 = btoa(String.fromCharCode(...compressed));
  return base64.replace(/\+/g, '-').replace(/\//g, '_');
}

interface PoeCharacterResponse {
  name: string;
  class: string;
  league: string;
  classId: number;
  ascendancyClass: number;
  level: number;
}

/**
 * Map ascendancy class ID + base class to ascendancy name
 */
function getAscendancyNameFromId(baseClass: string, ascendancyClassId: number): string | undefined {
  if (ascendancyClassId === 0) return undefined;

  const ascendancies: Record<string, string[]> = {
    'Scion': ['Ascendant'],
    'Marauder': ['Juggernaut', 'Berserker', 'Chieftain'],
    'Ranger': ['Warden', 'Deadeye', 'Pathfinder'], // Warden replaced Raider
    'Witch': ['Necromancer', 'Elementalist', 'Occultist'],
    'Duelist': ['Slayer', 'Gladiator', 'Champion'],
    'Templar': ['Inquisitor', 'Hierophant', 'Guardian'],
    'Shadow': ['Assassin', 'Saboteur', 'Trickster'],
  };

  const classAscendancies = ascendancies[baseClass];
  if (!classAscendancies) return undefined;

  // ascendancyClass is 1-indexed (1, 2, 3)
  const index = ascendancyClassId - 1;
  return classAscendancies[index];
}

/**
 * Fetch character info to get class/ascendancy if missing
 */
async function fetchCharacterInfoIfNeeded(run: Run, accountName?: string): Promise<{ class: string; ascendancy?: string }> {
  // If we already have valid class and ascendancy, use them
  if (run.class && run.class !== 'Unknown' && run.ascendancy) {
    return { class: run.class, ascendancy: run.ascendancy };
  }

  // Try to fetch from API
  const account = accountName || run.accountName;
  const character = run.characterName || run.character;

  if (account && character) {
    try {
      console.log('[PoB Export] Fetching character list for:', account);
      const response = await invoke<{ characters: PoeCharacterResponse[] }>('fetch_characters', { accountName: account });
      const charInfo = response.characters.find(c => c.name === character);

      if (charInfo) {
        console.log('[PoB Export] Found character info:', charInfo);
        const ascendancyName = getAscendancyNameFromId(charInfo.class, charInfo.ascendancyClass);
        console.log('[PoB Export] Derived ascendancy:', ascendancyName, 'from class:', charInfo.class, 'ascendancyClass:', charInfo.ascendancyClass);
        return {
          class: charInfo.class || run.class,
          ascendancy: ascendancyName || run.ascendancy || undefined,
        };
      }
    } catch (e) {
      console.warn('[PoB Export] Failed to fetch character info:', e);
    }
  }

  return { class: run.class, ascendancy: run.ascendancy || undefined };
}

/**
 * Export all snapshots for a run to clipboard
 */
export async function exportAllToPob(snapshots: Snapshot[], run: Run, splits?: Split[], accountName?: string): Promise<void> {
  // Try to get accurate class/ascendancy
  const charInfo = await fetchCharacterInfoIfNeeded(run, accountName);
  const enrichedRun = { ...run, class: charInfo.class, ascendancy: charInfo.ascendancy };

  const buildData = createMultiBuildData(snapshots, enrichedRun, splits);
  const code = encodeMultiPobCode(buildData);
  console.log('[PoB Multi-Export] Code length:', code.length);
  await navigator.clipboard.writeText(code);
}

/**
 * Upload all snapshots to pobb.in
 */
export async function shareAllOnPobbIn(snapshots: Snapshot[], run: Run, splits?: Split[], accountName?: string): Promise<string> {
  // Try to get accurate class/ascendancy
  const charInfo = await fetchCharacterInfoIfNeeded(run, accountName);
  const enrichedRun = { ...run, class: charInfo.class, ascendancy: charInfo.ascendancy };

  const buildData = createMultiBuildData(snapshots, enrichedRun, splits);
  const code = encodeMultiPobCode(buildData);
  const result = await invoke<{ url: string }>('upload_to_pobbin', { pobCode: code });
  return result.url;
}
