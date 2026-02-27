interface OverlayZoneProps {
  zoneName: string | null;
  fontSize?: 'small' | 'medium' | 'large';
  isAhead?: boolean;
  hotkeyHint?: string;
  showHotkeyHint?: boolean;
}

export function OverlayZone({ zoneName, fontSize = 'medium', isAhead, hotkeyHint, showHotkeyHint }: OverlayZoneProps) {
  const sizeClass = fontSize === 'small' ? 'text-xs' : fontSize === 'large' ? 'text-base' : 'text-sm';
  // Green when ahead of PB, amber when behind or no data; muted when empty
  const color = !zoneName ? '#4a4440' : isAhead === undefined ? '#9a8e82' : isAhead ? '#22c55e' : '#d4a574';

  const placeholder = showHotkeyHint
    ? `${hotkeyHint || 'Ctrl+Space'} to start`
    : 'Waiting for zone...';

  return (
    <div className="text-center">
      <div className={`${sizeClass} truncate`} style={{ color }} title={zoneName || undefined}>
        {zoneName || placeholder}
      </div>
    </div>
  );
}
