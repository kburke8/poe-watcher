interface OverlayZoneProps {
  zoneName: string | null;
}

export function OverlayZone({ zoneName }: OverlayZoneProps) {
  if (!zoneName) {
    return null;
  }

  return (
    <div className="text-center">
      <div className="text-sm text-[--color-poe-gold] truncate" title={zoneName}>
        {zoneName}
      </div>
    </div>
  );
}
