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

// PoE Website-style inventory layout
// Using CSS Grid with explicit positioning to match the official layout

export function EquipmentGrid({ items }: EquipmentGridProps) {
  const [weaponSet, setWeaponSet] = useState<1 | 2>(1);

  // Grid cell size in pixels
  const cellSize = 32;

  // Check if weapon swap exists
  const hasWeaponSwap = items.has('Weapon2') || items.has('Offhand2');

  // Get weapon/offhand based on selected set
  const weaponKey = weaponSet === 1 ? 'Weapon' : 'Weapon2';
  const offhandKey = weaponSet === 1 ? 'Offhand' : 'Offhand2';

  // Get flasks - stored as Flask1 through Flask5
  const flasks = [1, 2, 3, 4, 5].map((i) => items.get(`Flask${i}`) || null);

  return (
    <div className="space-y-4">
      {/* Weapon Set Toggle */}
      {hasWeaponSwap && (
        <div className="flex justify-center gap-1">
          <button
            onClick={() => setWeaponSet(1)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              weaponSet === 1
                ? 'bg-[#8a7a5a] text-white'
                : 'bg-[#1a1a2e] text-[#6a6a8a] hover:bg-[#2a2a4a]'
            }`}
          >
            I
          </button>
          <button
            onClick={() => setWeaponSet(2)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              weaponSet === 2
                ? 'bg-[#8a7a5a] text-white'
                : 'bg-[#1a1a2e] text-[#6a6a8a] hover:bg-[#2a2a4a]'
            }`}
          >
            II
          </button>
        </div>
      )}

      {/* Main equipment grid - matches PoE website layout */}
      <div
        className="grid gap-1 mx-auto"
        style={{
          gridTemplateColumns: `repeat(9, ${cellSize}px)`,
          gridTemplateRows: `repeat(7, ${cellSize}px)`,
          width: 'fit-content',
        }}
      >
        {/* Weapon - Left side, 2 cols x 4 rows */}
        <GridSlot
          item={items.get(weaponKey)}
          label="Weapon"
          col="1 / 3"
          row="1 / 5"
        />

        {/* Helm - Top center, 2 cols x 2 rows */}
        <GridSlot
          item={items.get('Helm')}
          label="Helm"
          col="4 / 6"
          row="1 / 3"
        />

        {/* Body Armour - Center, 2 cols x 3 rows */}
        <GridSlot
          item={items.get('BodyArmour')}
          label="Body"
          col="4 / 6"
          row="3 / 6"
        />

        {/* Amulet - Right side, above Ring 2 */}
        <GridSlot
          item={items.get('Amulet')}
          label="Amulet"
          col="6 / 7"
          row="4 / 5"
        />

        {/* Ring 1 - Left of body, just above Gloves */}
        <GridSlot
          item={items.get('Ring')}
          label="Ring"
          col="3 / 4"
          row="5 / 6"
        />

        {/* Ring 2 - Right of body, below Amulet, just above Boots */}
        <GridSlot
          item={items.get('Ring2')}
          label="Ring"
          col="6 / 7"
          row="5 / 6"
        />

        {/* Gloves - Bottom left, 2 cols x 2 rows */}
        <GridSlot
          item={items.get('Gloves')}
          label="Gloves"
          col="2 / 4"
          row="6 / 8"
        />

        {/* Belt - Below body, 2 cols x 1 row */}
        <GridSlot
          item={items.get('Belt')}
          label="Belt"
          col="4 / 6"
          row="6 / 7"
        />

        {/* Boots - Bottom right, 2 cols x 2 rows */}
        <GridSlot
          item={items.get('Boots')}
          label="Boots"
          col="6 / 8"
          row="6 / 8"
        />

        {/* Offhand/Shield - Right side, 2 cols x 4 rows */}
        <GridSlot
          item={items.get(offhandKey)}
          label="Offhand"
          col="8 / 10"
          row="1 / 5"
        />
      </div>

      {/* Flask slots */}
      <div className="flex gap-1 justify-center">
        {flasks.map((flask, i) => (
          <FlaskSlot
            key={`flask-${i}`}
            item={flask ?? undefined}
            label={`${i + 1}`}
            cellSize={cellSize}
          />
        ))}
      </div>
    </div>
  );
}

interface GridSlotProps {
  item?: PoeItem;
  label: string;
  col: string;
  row: string;
}

function GridSlot({ item, label, col, row }: GridSlotProps) {
  if (!item) {
    return (
      <div
        className="bg-[#0a0a14] border border-[#2a2a4a] rounded-sm flex items-center justify-center"
        style={{ gridColumn: col, gridRow: row }}
      >
        <span className="text-[8px] text-[#4a4a6a] text-center">{label}</span>
      </div>
    );
  }

  const displayName = item.name || item.typeLine;

  return (
    <div
      className="bg-[#0a0a14] border border-[#2a2a4a] rounded-sm flex items-center justify-center relative overflow-hidden hover:border-[#8a7a5a] transition-colors cursor-pointer"
      style={{ gridColumn: col, gridRow: row }}
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
        <span className="text-[8px] text-[#8a8a9a] text-center px-0.5 line-clamp-2">
          {displayName}
        </span>
      )}
      {/* Socket display */}
      {item.sockets && item.sockets.length > 0 && (
        <SocketOverlay sockets={item.sockets} />
      )}
    </div>
  );
}

interface FlaskSlotProps {
  item?: PoeItem;
  label: string;
  cellSize: number;
}

function FlaskSlot({ item, label, cellSize }: FlaskSlotProps) {
  const width = cellSize;
  const height = cellSize * 2;

  if (!item) {
    return (
      <div
        className="bg-[#0a0a14] border border-[#2a2a4a] rounded-sm flex items-center justify-center"
        style={{ width, height }}
      >
        <span className="text-[10px] text-[#4a4a6a]">{label}</span>
      </div>
    );
  }

  const displayName = item.name || item.typeLine;

  return (
    <div
      className="bg-[#0a0a14] border border-[#2a2a4a] rounded-sm flex items-center justify-center relative overflow-hidden hover:border-[#8a7a5a] transition-colors cursor-pointer"
      style={{ width, height }}
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
        <span className="text-[9px] text-[#8a8a9a] text-center line-clamp-3">
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
    <div className="absolute bottom-0.5 right-0.5 flex flex-wrap gap-px justify-end max-w-[60%]">
      {sockets.map((socket, i) => {
        const isLinked = i > 0 && sockets[i - 1]?.group === socket.group;
        return (
          <div key={i} className="flex items-center">
            {isLinked && (
              <div className="w-1 h-0.5 bg-[#8a7a5a] -mx-px" />
            )}
            <div
              className={`w-2 h-2 rounded-full border ${SOCKET_COLORS[socket.attr] || 'bg-gray-500'} ${SOCKET_BORDER_COLORS[socket.attr] || 'border-gray-600'}`}
            />
          </div>
        );
      })}
    </div>
  );
}

