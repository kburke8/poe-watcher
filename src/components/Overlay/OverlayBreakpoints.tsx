interface OverlayBreakpointsProps {
  breakpoints: string[];
}

export function OverlayBreakpoints({ breakpoints }: OverlayBreakpointsProps) {
  // Show only the next 2-3 breakpoints
  const visibleBreakpoints = breakpoints.slice(0, 3);

  return (
    <div className="pt-2" style={{ borderTop: '1px solid #3a3a3e' }}>
      <div className="text-xs mb-1" style={{ color: '#6b7280' }}>Upcoming:</div>
      <div className="space-y-0.5">
        {visibleBreakpoints.map((bp, index) => (
          <div
            key={index}
            className="text-xs truncate"
            style={{ color: index === 0 ? '#e5e5e5' : '#9ca3af' }}
            title={bp}
          >
            {index === 0 ? '> ' : '  '}
            {bp}
          </div>
        ))}
      </div>
    </div>
  );
}
