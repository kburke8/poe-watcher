import type { PoeItem } from '../../types';
import { getFrameTypeColor } from '../../stores/snapshotStore';

interface SkillsDisplayProps {
  items: PoeItem[];
}

interface GemGroup {
  parentItem: PoeItem;
  gems: PoeItem[];
}

export function SkillsDisplay({ items }: SkillsDisplayProps) {
  // Group gems by their parent item (equipment slot)
  const gemGroups: GemGroup[] = [];

  for (const item of items) {
    if (item.socketedItems && item.socketedItems.length > 0) {
      gemGroups.push({
        parentItem: item,
        gems: item.socketedItems,
      });
    }
  }

  if (gemGroups.length === 0) {
    return (
      <div className="text-center text-[--color-text-muted] py-8">
        No socketed gems found in equipment.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {gemGroups.map((group, idx) => (
        <GemGroupDisplay key={idx} group={group} />
      ))}
    </div>
  );
}

interface GemGroupDisplayProps {
  group: GemGroup;
}

function GemGroupDisplay({ group }: GemGroupDisplayProps) {
  const { parentItem, gems } = group;

  // Group gems by socket group (linked gems)
  const socketGroups = new Map<number, PoeItem[]>();

  // Find socket links from parent item
  const sockets = parentItem.sockets || [];
  const socketGroupMap = new Map<number, number>(); // socketIndex -> groupNumber

  sockets.forEach((socket, idx) => {
    socketGroupMap.set(idx, socket.group);
  });

  // Assign gems to their socket groups
  gems.forEach((gem, idx) => {
    const groupNum = socketGroupMap.get(idx) ?? idx;
    const existing = socketGroups.get(groupNum) || [];
    existing.push(gem);
    socketGroups.set(groupNum, existing);
  });

  return (
    <div className="bg-[--color-surface-elevated] rounded-lg p-4">
      {/* Parent item header */}
      <div className="mb-3 pb-2 border-b border-[--color-border]">
        <span className={`font-medium ${getFrameTypeColor(parentItem.frameType)}`}>
          {parentItem.name || parentItem.typeLine}
        </span>
        <span className="text-xs text-[--color-text-muted] ml-2">
          ({parentItem.inventoryId})
        </span>
      </div>

      {/* Gem groups (linked gems) */}
      <div className="space-y-3">
        {Array.from(socketGroups.entries()).map(([groupNum, groupGems]) => (
          <div key={groupNum} className="flex flex-wrap gap-2 items-center">
            {groupGems.map((gem, idx) => (
              <GemDisplay key={idx} gem={gem} isLast={idx === groupGems.length - 1} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface GemDisplayProps {
  gem: PoeItem;
  isLast: boolean;
}

function GemDisplay({ gem, isLast }: GemDisplayProps) {
  const isSupport = gem.typeLine.includes('Support');
  const gemName = gem.typeLine.replace(' Support', '');

  return (
    <div className="flex items-center">
      <div
        className={`px-2 py-1 rounded text-xs ${
          isSupport
            ? 'bg-blue-900/50 text-blue-300 border border-blue-700/50'
            : 'bg-red-900/50 text-red-300 border border-red-700/50'
        }`}
        title={gem.explicitMods?.join('\n')}
      >
        {gemName}
      </div>
      {!isLast && (
        <span className="text-[--color-text-muted] mx-1">-</span>
      )}
    </div>
  );
}
