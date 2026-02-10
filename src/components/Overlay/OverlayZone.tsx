interface OverlayZoneProps {
  zoneName: string | null;
}

export function OverlayZone({ zoneName }: OverlayZoneProps) {
  if (!zoneName) {
    return null;
  }

  return (
    <div className="text-center">
      <div className="text-sm truncate" style={{ color: '#d4a574' }} title={zoneName}>
        {zoneName}
      </div>
    </div>
  );
}
