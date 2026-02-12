interface OverlayZoneProps {
  zoneName: string | null;
  fontSize?: 'small' | 'medium' | 'large';
  isAhead?: boolean;
}

export function OverlayZone({ zoneName, fontSize = 'medium', isAhead }: OverlayZoneProps) {
  if (!zoneName) {
    return null;
  }

  const sizeClass = fontSize === 'small' ? 'text-xs' : fontSize === 'large' ? 'text-base' : 'text-sm';
  // Green when ahead of PB, amber when behind or no data
  const color = isAhead === undefined ? '#9ca3af' : isAhead ? '#22c55e' : '#d4a574';

  return (
    <div className="text-center">
      <div className={`${sizeClass} truncate`} style={{ color }} title={zoneName}>
        {zoneName}
      </div>
    </div>
  );
}
