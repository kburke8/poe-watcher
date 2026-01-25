import pako from 'pako';
import { invoke } from '@tauri-apps/api/core';
import type { PoeItem, Snapshot, Run } from '../types';

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

  // Map class names to PoB format
  // Includes PoE 1 classes and PoE 2 -> PoE 1 mappings for compatibility
  const classMap: Record<string, string> = {
    // PoE 1 classes
    Marauder: 'Marauder',
    Ranger: 'Ranger',
    Witch: 'Witch',
    Duelist: 'Duelist',
    Templar: 'Templar',
    Shadow: 'Shadow',
    Scion: 'Scion',
    // PoE 2 classes -> PoE 1 equivalents (for compatibility)
    Warrior: 'Marauder',
    Mercenary: 'Duelist',
    Huntress: 'Ranger',
    Monk: 'Templar',
    Sorceress: 'Witch',
    Druid: 'Witch',
    Warden: 'Ranger', // Warden is a Ranger ascendancy in PoE 2
  };

  const rawClass = character.class;
  const className = classMap[rawClass] || 'Scion'; // Default to Scion if unknown
  const ascendClassName = character.ascendancy || 'None';
  const classId = getClassId(className);
  const ascendId = getAscendancyId(character.ascendancy);
  console.log(`[PoB Export] Class mapping: "${rawClass}" -> className="${className}" (classId=${classId}), ascendancy="${ascendClassName}" (ascendClassId=${ascendId})`);

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
