import { useState } from 'react';
import type { PoeItem, PoeSocket } from '../../types';

interface EquipmentGridProps {
  items: Map<string, PoeItem>;
}

// Socket color mapping
const SOCKET_COLORS: Record<string, string> = {
  'S': 'bg-red-500',      // Strength - Red
  'D': 'bg-green-500',    // Dexterity - Green
  'I': 'bg-blue-500',     // Intelligence - Blue
  'G': 'bg-gray-200',     // Generic - White
  'A': 'bg-gray-800',     // Abyss - Dark
  'DV': 'bg-yellow-500',  // Delve - Yellow
};

const SOCKET_BORDER_COLORS: Record<string, string> = {
  'S': 'border-red-700',
  'D': 'border-green-700',
  'I': 'border-blue-700',
  'G': 'border-gray-400',
  'A': 'border-gray-600',
  'DV': 'border-yellow-700',
};

// PoE-style inventory layout with larger cells
const CELL = 42; // px per grid cell
const GAP = 2;   // px gap between cells

export function EquipmentGrid({ items }: EquipmentGridProps) {
  const [weaponSet, setWeaponSet] = useState<1 | 2>(1);

  const hasWeaponSwap = items.has('Weapon2') || items.has('Offhand2');
  const weaponKey = weaponSet === 1 ? 'Weapon' : 'Weapon2';
  const offhandKey = weaponSet === 1 ? 'Offhand' : 'Offhand2';
  const flasks = [1, 2, 3, 4, 5].map((i) => items.get(`Flask${i}`) || null);

  return (
    <div className="space-y-3">
      {/* Weapon Set Toggle */}
      {hasWeaponSwap && (
        <div className="flex justify-center gap-1">
          <button
            onClick={() => setWeaponSet(1)}
            className={`w-7 h-7 text-xs font-semibold rounded transition-colors ${
              weaponSet === 1
                ? 'bg-[--color-poe-gold] text-[--color-poe-darker]'
                : 'bg-[--color-surface-elevated] text-[--color-text-muted] hover:text-[--color-text]'
            }`}
          >
            I
          </button>
          <button
            onClick={() => setWeaponSet(2)}
            className={`w-7 h-7 text-xs font-semibold rounded transition-colors ${
              weaponSet === 2
                ? 'bg-[--color-poe-gold] text-[--color-poe-darker]'
                : 'bg-[--color-surface-elevated] text-[--color-text-muted] hover:text-[--color-text]'
            }`}
          >
            II
          </button>
        </div>
      )}

      {/* Main equipment grid
           Cols: [weapon 2] [ring1] [body 2] [ring2/amulet] [offhand 2] = 8 cols */}
      <div
        className="grid mx-auto"
        style={{
          gridTemplateColumns: `repeat(8, ${CELL}px)`,
          gridTemplateRows: `repeat(6, ${CELL}px)`,
          gap: `${GAP}px`,
          width: 'fit-content',
        }}
      >
        {/* Weapon - cols 1-2, rows 1-4 */}
        <GridSlot item={items.get(weaponKey)} col="1 / 3" row="1 / 5" />
        {/* Helm - cols 4-5, rows 1-2 */}
        <GridSlot item={items.get('Helm')} col="4 / 6" row="1 / 3" />
        {/* Offhand - cols 7-8, rows 1-4 */}
        <GridSlot item={items.get(offhandKey)} col="7 / 9" row="1 / 5" />
        {/* Ring 1 - col 3, row 4 (level with Ring 2) */}
        <GridSlot item={items.get('Ring')} col="3 / 4" row="4 / 5" />
        {/* Amulet - col 6, row 3 */}
        <GridSlot item={items.get('Amulet')} col="6 / 7" row="3 / 4" />
        {/* Body - cols 4-5, rows 3-5 */}
        <GridSlot item={items.get('BodyArmour')} col="4 / 6" row="3 / 6" />
        {/* Ring 2 - col 6, row 4 */}
        <GridSlot item={items.get('Ring2')} col="6 / 7" row="4 / 5" />
        {/* Gloves - cols 2-3, rows 5-6 */}
        <GridSlot item={items.get('Gloves')} col="2 / 4" row="5 / 7" />
        {/* Belt - cols 4-5, row 6 */}
        <GridSlot item={items.get('Belt')} col="4 / 6" row="6 / 7" />
        {/* Boots - cols 6-7, rows 5-6 */}
        <GridSlot item={items.get('Boots')} col="6 / 8" row="5 / 7" />
      </div>

      {/* Flask row */}
      <div className="flex justify-center" style={{ gap: `${GAP}px` }}>
        {flasks.map((flask, i) => (
          <FlaskSlot key={`flask-${i}`} item={flask ?? undefined} />
        ))}
      </div>
    </div>
  );
}

interface GridSlotProps {
  item?: PoeItem;
  col: string;
  row: string;
}

function GridSlot({ item, col, row }: GridSlotProps) {
  if (!item) {
    return (
      <div
        className="rounded bg-[--color-poe-darker] border border-[--color-border]/50"
        style={{ gridColumn: col, gridRow: row }}
      />
    );
  }

  const displayName = item.name || item.typeLine;

  return (
    <div
      className="rounded bg-[--color-poe-darker] border border-[--color-border]/50 flex items-center justify-center relative overflow-hidden hover:border-[--color-poe-gold]/60 transition-colors cursor-pointer group"
      style={{ gridColumn: col, gridRow: row }}
      title={`${item.name}\n${item.typeLine}\n${item.explicitMods?.join('\n') || ''}`}
    >
      {item.icon ? (
        <img
          src={item.icon}
          alt={displayName}
          className="max-w-full max-h-full object-contain p-0.5 group-hover:scale-105 transition-transform"
          loading="lazy"
        />
      ) : (
        <span className="text-[9px] text-[--color-text-muted] text-center px-1 line-clamp-2">
          {displayName}
        </span>
      )}
      {item.sockets && item.sockets.length > 0 && (
        <SocketOverlay sockets={item.sockets} />
      )}
    </div>
  );
}

interface FlaskSlotProps {
  item?: PoeItem;
}

function FlaskSlot({ item }: FlaskSlotProps) {
  if (!item) {
    return (
      <div
        className="rounded bg-[--color-poe-darker] border border-[--color-border]/50"
        style={{ width: CELL, height: CELL * 2 }}
      />
    );
  }

  const displayName = item.name || item.typeLine;

  return (
    <div
      className="rounded bg-[--color-poe-darker] border border-[--color-border]/50 flex items-center justify-center relative overflow-hidden hover:border-[--color-poe-gold]/60 transition-colors cursor-pointer group"
      style={{ width: CELL, height: CELL * 2 }}
      title={`${item.name}\n${item.typeLine}\n${item.explicitMods?.join('\n') || ''}`}
    >
      {item.icon ? (
        <img
          src={item.icon}
          alt={displayName}
          className="max-w-full max-h-full object-contain p-0.5 group-hover:scale-105 transition-transform"
          loading="lazy"
        />
      ) : (
        <span className="text-[9px] text-[--color-text-muted] text-center line-clamp-3">
          {displayName}
        </span>
      )}
    </div>
  );
}

interface SocketOverlayProps {
  sockets: PoeSocket[];
}

function SocketOverlay({ sockets }: SocketOverlayProps) {
  if (!sockets || sockets.length === 0) return null;

  return (
    <div className="absolute bottom-1 right-1 flex flex-wrap gap-0.5 justify-end max-w-[70%]">
      {sockets.map((socket, i) => {
        const isLinked = i > 0 && sockets[i - 1]?.group === socket.group;
        return (
          <div key={i} className="flex items-center">
            {isLinked && (
              <div className="w-1.5 h-0.5 bg-[--color-poe-gold-light]/60 -mx-0.5" />
            )}
            <div
              className={`w-2.5 h-2.5 rounded-full border ${SOCKET_COLORS[socket.attr] || 'bg-gray-500'} ${SOCKET_BORDER_COLORS[socket.attr] || 'border-gray-600'}`}
            />
          </div>
        );
      })}
    </div>
  );
}
