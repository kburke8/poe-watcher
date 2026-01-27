import type { PoeItem } from '../../types';

interface SkillsDisplayProps {
  items: PoeItem[];
  compact?: boolean;
  columns?: 1 | 2;
}

interface GemGroup {
  parentItem: PoeItem;
  gems: PoeItem[];
  slot: string;
}

// Slot display order (like pobb.in)
const SLOT_ORDER = [
  'Weapon', 'Weapon2', 'Offhand', 'Offhand2',
  'Helm', 'BodyArmour', 'Gloves', 'Boots',
  'Amulet', 'Ring', 'Ring2', 'Belt'
];

// Slot icons (simple text representations)
const SLOT_LABELS: Record<string, string> = {
  'Weapon': '⚔️',
  'Weapon2': '⚔️',
  'Offhand': '🛡️',
  'Offhand2': '🛡️',
  'Helm': '🪖',
  'BodyArmour': '👕',
  'Gloves': '🧤',
  'Boots': '👢',
  'Amulet': '📿',
  'Ring': '💍',
  'Ring2': '💍',
  'Belt': '🎗️',
};

export function SkillsDisplay({ items, compact = false, columns = 1 }: SkillsDisplayProps) {
  // Group gems by their parent item (equipment slot)
  const gemGroups: GemGroup[] = [];

  for (const item of items) {
    if (item.socketedItems && item.socketedItems.length > 0) {
      gemGroups.push({
        parentItem: item,
        gems: item.socketedItems,
        slot: item.inventoryId,
      });
    }
  }

  // Sort by slot order
  gemGroups.sort((a, b) => {
    const aIdx = SLOT_ORDER.indexOf(a.slot);
    const bIdx = SLOT_ORDER.indexOf(b.slot);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  if (gemGroups.length === 0) {
    return (
      <div className="text-center text-[#6a6a8a] py-4 text-sm">
        No socketed gems
      </div>
    );
  }

  const gridClass = columns === 2
    ? "grid grid-cols-2 gap-2"
    : compact ? "space-y-2" : "space-y-4";

  return (
    <div className={gridClass}>
      {gemGroups.map((group, idx) => (
        <GemGroupDisplay key={idx} group={group} compact={compact} />
      ))}
    </div>
  );
}

interface GemGroupDisplayProps {
  group: GemGroup;
  compact?: boolean;
}

interface GemWithSocket {
  gem: PoeItem;
  socketColor: string; // 'S' | 'D' | 'I' | 'G' | etc.
}

function GemGroupDisplay({ group, compact = false }: GemGroupDisplayProps) {
  const { parentItem, gems, slot } = group;

  // Find socket info from parent item
  const sockets = parentItem.sockets || [];

  // Group gems by socket group (linked gems), preserving socket color
  const socketGroups = new Map<number, GemWithSocket[]>();

  gems.forEach((gem, idx) => {
    const socket = sockets[idx];
    const groupNum = socket?.group ?? idx;
    const socketColor = socket?.attr ?? 'G';

    const existing = socketGroups.get(groupNum) || [];
    existing.push({ gem, socketColor });
    socketGroups.set(groupNum, existing);
  });

  const slotIcon = SLOT_LABELS[slot] || '📦';

  return (
    <div className={`bg-[#0d0d1a] rounded-lg ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      {/* Gems with slot icon on right */}
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1">
          {Array.from(socketGroups.entries()).map(([groupNum, groupGems]) => (
            <div key={groupNum} className="leading-tight">
              {groupGems.map((gemWithSocket, idx) => (
                <GemDisplay
                  key={idx}
                  gem={gemWithSocket.gem}
                  socketColor={gemWithSocket.socketColor}
                  isFirst={idx === 0}
                  isLast={idx === groupGems.length - 1}
                  isOnly={groupGems.length === 1}
                  compact={compact}
                />
              ))}
            </div>
          ))}
        </div>
        <div
          className="text-lg opacity-60 shrink-0"
          title={slot}
        >
          {slotIcon}
        </div>
      </div>
    </div>
  );
}

// Gem color based on socket attribute
const GEM_COLORS: Record<string, string> = {
  'S': 'text-red-400',      // Strength - Red
  'D': 'text-green-400',    // Dexterity - Green
  'I': 'text-blue-400',     // Intelligence - Blue
  'G': 'text-slate-200',    // Generic - White
  'A': 'text-slate-400',    // Abyss
  'DV': 'text-yellow-400',  // Delve
};

interface GemDisplayProps {
  gem: PoeItem;
  socketColor: string;
  isFirst: boolean;
  isLast: boolean;
  isOnly: boolean;
  compact?: boolean;
}

function GemDisplay({ gem, socketColor, isFirst, isLast, isOnly, compact = false }: GemDisplayProps) {
  const isSupport = gem.typeLine.includes('Support');
  const gemName = gem.typeLine.replace(' Support', '');

  // Color based on socket attribute (Str=red, Dex=green, Int=blue)
  const colorClass = GEM_COLORS[socketColor] || 'text-slate-200';

  // Active gems (non-support) are bold
  const fontClass = !isSupport ? 'font-medium' : '';

  // Link indicator styling (like pobb.in's gem-first, gem-middle, gem-last)
  let linkClass = '';
  if (!isOnly && isSupport) {
    if (isFirst) {
      linkClass = 'before:content-[""] before:inline-block before:w-2 before:h-3 before:ml-2 before:border-l before:border-b before:border-[#6a6a8a] before:align-middle before:-translate-y-0.5';
    } else if (isLast) {
      linkClass = 'before:content-[""] before:inline-block before:w-2 before:h-3 before:ml-2 before:border-l before:border-[#6a6a8a] before:align-middle before:translate-y-0.5';
    } else {
      linkClass = 'before:content-[""] before:inline-block before:w-2 before:h-3 before:ml-2 before:border-l before:border-[#6a6a8a] before:align-middle';
    }
  }

  return (
    <div
      className={`${compact ? 'text-xs' : 'text-sm'} ${colorClass} ${fontClass} ${linkClass} truncate`}
      title={`${gem.typeLine}\n${gem.explicitMods?.join('\n') || ''}`}
    >
      {gemName}
    </div>
  );
}
