import type { PoeItem } from '../../types';
import { getFrameTypeColor } from '../../stores/snapshotStore';

interface EquipmentGridProps {
  items: Map<string, PoeItem>;
}

// Equipment slots in display order
const EQUIPMENT_SLOTS = [
  { id: 'Weapon', label: 'Weapon', row: 1, col: 1 },
  { id: 'Helm', label: 'Helmet', row: 1, col: 2 },
  { id: 'Offhand', label: 'Offhand', row: 1, col: 3 },
  { id: 'BodyArmour', label: 'Body', row: 2, col: 2 },
  { id: 'Gloves', label: 'Gloves', row: 2, col: 1 },
  { id: 'Boots', label: 'Boots', row: 2, col: 3 },
  { id: 'Amulet', label: 'Amulet', row: 1, col: 4 },
  { id: 'Ring', label: 'Ring L', row: 2, col: 4 },
  { id: 'Ring2', label: 'Ring R', row: 3, col: 4 },
  { id: 'Belt', label: 'Belt', row: 3, col: 2 },
];

// Alternate weapon slots (for weapon swap)
const WEAPON2_SLOTS = [
  { id: 'Weapon2', label: 'Weapon 2', row: 3, col: 1 },
  { id: 'Offhand2', label: 'Offhand 2', row: 3, col: 3 },
];

export function EquipmentGrid({ items }: EquipmentGridProps) {
  return (
    <div className="space-y-4">
      {/* Main equipment grid */}
      <div className="grid grid-cols-4 gap-3">
        {EQUIPMENT_SLOTS.map((slot) => {
          const item = items.get(slot.id);
          return (
            <EquipmentSlot
              key={slot.id}
              label={slot.label}
              item={item}
            />
          );
        })}
      </div>

      {/* Weapon swap (if present) */}
      {(items.has('Weapon2') || items.has('Offhand2')) && (
        <div>
          <div className="text-xs text-[--color-text-muted] mb-2">Weapon Swap</div>
          <div className="grid grid-cols-4 gap-3">
            {WEAPON2_SLOTS.map((slot) => {
              const item = items.get(slot.id);
              return (
                <EquipmentSlot
                  key={slot.id}
                  label={slot.label}
                  item={item}
                />
              );
            })}
            {/* Empty slots for alignment */}
            <div className="col-span-2" />
          </div>
        </div>
      )}

      {/* Flask slots */}
      <div>
        <div className="text-xs text-[--color-text-muted] mb-2">Flasks</div>
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((i) => {
            const item = items.get(`Flask${i + 1}`);
            return (
              <EquipmentSlot
                key={`flask-${i}`}
                label={`Flask ${i + 1}`}
                item={item}
                small
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface EquipmentSlotProps {
  label: string;
  item?: PoeItem;
  small?: boolean;
}

function EquipmentSlot({ label, item, small = false }: EquipmentSlotProps) {
  const baseClasses = small
    ? 'aspect-square p-2'
    : 'aspect-square p-3';

  if (!item) {
    return (
      <div
        className={`${baseClasses} bg-[--color-surface-elevated] rounded-lg border border-[--color-border] border-dashed flex items-center justify-center`}
      >
        <span className="text-xs text-[--color-text-muted] text-center">{label}</span>
      </div>
    );
  }

  const displayName = item.name || item.typeLine;
  const colorClass = getFrameTypeColor(item.frameType);

  return (
    <div
      className={`${baseClasses} bg-[--color-surface-elevated] rounded-lg border border-[--color-border] flex flex-col items-center justify-center hover:border-[--color-poe-gold]/50 transition-colors cursor-pointer group relative`}
      title={`${item.name}\n${item.typeLine}\n${item.explicitMods?.join('\n') || ''}`}
    >
      <span className={`text-xs ${colorClass} text-center line-clamp-2 group-hover:line-clamp-none`}>
        {displayName}
      </span>
      {item.socketedItems && item.socketedItems.length > 0 && (
        <div className="absolute bottom-1 right-1 text-xs text-[--color-text-muted] bg-[--color-surface] rounded px-1">
          {item.socketedItems.length}G
        </div>
      )}
    </div>
  );
}
