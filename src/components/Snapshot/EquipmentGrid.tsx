import type { PoeItem } from '../../types';
import { getFrameTypeColor } from '../../stores/snapshotStore';

interface EquipmentGridProps {
  items: Map<string, PoeItem>;
}

// Classic PoE character screen layout:
//           [Helm]
// [Weapon] [Body]  [Offhand]
//           [Belt]
// [Gloves]         [Boots]
// [Ring L] [Amulet] [Ring R]

export function EquipmentGrid({ items }: EquipmentGridProps) {
  return (
    <div className="space-y-4">
      {/* Main equipment grid - 3 columns, 5 rows */}
      <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
        {/* Row 1: Helm centered */}
        <div /> {/* Empty left */}
        <EquipmentSlot label="Helm" item={items.get('Helm')} />
        <div /> {/* Empty right */}

        {/* Row 2: Weapon, Body, Offhand */}
        <EquipmentSlot label="Weapon" item={items.get('Weapon')} tall />
        <EquipmentSlot label="Body" item={items.get('BodyArmour')} tall />
        <EquipmentSlot label="Offhand" item={items.get('Offhand')} tall />

        {/* Row 3: Belt centered */}
        <div /> {/* Empty left */}
        <EquipmentSlot label="Belt" item={items.get('Belt')} />
        <div /> {/* Empty right */}

        {/* Row 4: Gloves, empty, Boots */}
        <EquipmentSlot label="Gloves" item={items.get('Gloves')} />
        <div /> {/* Empty center */}
        <EquipmentSlot label="Boots" item={items.get('Boots')} />

        {/* Row 5: Ring, Amulet, Ring2 */}
        <EquipmentSlot label="Ring" item={items.get('Ring')} small />
        <EquipmentSlot label="Amulet" item={items.get('Amulet')} small />
        <EquipmentSlot label="Ring" item={items.get('Ring2')} small />
      </div>

      {/* Weapon swap (if present) */}
      {(items.has('Weapon2') || items.has('Offhand2')) && (
        <div>
          <div className="text-xs text-[--color-text-muted] mb-2 text-center">Weapon Swap</div>
          <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
            <EquipmentSlot label="Weapon 2" item={items.get('Weapon2')} tall />
            <div /> {/* Empty center */}
            <EquipmentSlot label="Offhand 2" item={items.get('Offhand2')} tall />
          </div>
        </div>
      )}

      {/* Flask slots */}
      <div>
        <div className="text-xs text-[--color-text-muted] mb-2 text-center">Flasks</div>
        <div className="grid grid-cols-5 gap-2 max-w-[300px] mx-auto">
          {[0, 1, 2, 3, 4].map((i) => {
            const item = items.get(`Flask${i + 1}`);
            return (
              <EquipmentSlot
                key={`flask-${i}`}
                label={`${i + 1}`}
                item={item}
                flask
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
  tall?: boolean;
  flask?: boolean;
}

function EquipmentSlot({ label, item, small = false, tall = false, flask = false }: EquipmentSlotProps) {
  // Size classes based on slot type
  const sizeClasses = flask
    ? 'aspect-[1/2] p-1'  // Flasks are tall and narrow
    : tall
    ? 'aspect-[1/1.5] p-1'  // Weapons/body are taller
    : small
    ? 'aspect-square p-1 min-h-[50px]'  // Rings/amulet are smaller squares
    : 'aspect-square p-1';  // Default square

  if (!item) {
    return (
      <div
        className={`${sizeClasses} bg-[--color-surface-elevated] rounded border border-[--color-border] border-dashed flex items-center justify-center`}
      >
        <span className="text-[10px] text-[--color-text-muted] text-center opacity-50">{label}</span>
      </div>
    );
  }

  const displayName = item.name || item.typeLine;
  const colorClass = getFrameTypeColor(item.frameType);
  const borderColorClass = item.frameType === 3 ? 'border-[--color-poe-unique]/60' :
                           item.frameType === 2 ? 'border-[--color-poe-rare]/60' :
                           item.frameType === 1 ? 'border-[--color-poe-magic]/60' :
                           'border-[--color-border]';

  return (
    <div
      className={`${sizeClasses} bg-[--color-surface-elevated] rounded border ${borderColorClass} flex flex-col items-center justify-center hover:border-[--color-poe-gold]/70 transition-colors cursor-pointer group relative overflow-hidden`}
      title={`${item.name}\n${item.typeLine}\n${item.explicitMods?.join('\n') || ''}`}
    >
      {item.icon ? (
        <img
          src={item.icon}
          alt={displayName}
          className="max-w-full max-h-full object-contain"
          loading="lazy"
        />
      ) : (
        <span className={`text-[10px] ${colorClass} text-center line-clamp-2 px-0.5`}>
          {displayName}
        </span>
      )}
      {item.socketedItems && item.socketedItems.length > 0 && (
        <div className="absolute bottom-0 right-0 text-[9px] text-[--color-text-muted] bg-[--color-surface]/90 rounded-tl px-1">
          {item.socketedItems.length}G
        </div>
      )}
    </div>
  );
}
