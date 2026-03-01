interface OverlayFinalTimeProps {
  finalTimeMs: number;
  fontSize?: 'small' | 'medium' | 'large';
  scale?: 'small' | 'medium' | 'large';
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function OverlayFinalTime({ finalTimeMs, fontSize = 'medium', scale = 'medium' }: OverlayFinalTimeProps) {
  const sizeClass = fontSize === 'small' ? 'text-xs' : fontSize === 'large' ? 'text-base' : 'text-sm';
  const ptClass = scale === 'small' ? 'pt-1' : 'pt-2';

  return (
    <div className={ptClass} style={{ borderTop: '1px solid rgba(58, 58, 62, 0.5)' }}>
      <div className={`flex items-center justify-between ${sizeClass}`}>
        <span style={{ color: '#9a8e82' }}>Act 10</span>
        <span className="font-mono font-medium" style={{ color: '#22c55e' }}>
          {formatTime(finalTimeMs)}
        </span>
      </div>
    </div>
  );
}
