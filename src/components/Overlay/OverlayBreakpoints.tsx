interface OverlayBreakpointsProps {
  breakpoints: string[];
}

export function OverlayBreakpoints({ breakpoints }: OverlayBreakpointsProps) {
  // Show only the next 2-3 breakpoints
  const visibleBreakpoints = breakpoints.slice(0, 3);

  return (
    <div className="border-t border-[--color-border] pt-2">
      <div className="text-xs text-[--color-text-muted] mb-1">Upcoming:</div>
      <div className="space-y-0.5">
        {visibleBreakpoints.map((bp, index) => (
          <div
            key={index}
            className={`text-xs truncate ${
              index === 0 ? 'text-[--color-text]' : 'text-[--color-text-muted]'
            }`}
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
