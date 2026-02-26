import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface HelpTipProps {
  children: React.ReactNode;
}

export function HelpTip({ children }: HelpTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className={`inline-flex items-center justify-center rounded-full transition-colors ${
          open
            ? 'text-[--color-poe-gold]'
            : 'text-[--color-text-muted] hover:text-[--color-text]'
        }`}
        title="Help"
        type="button"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <div className="w-full text-xs text-[--color-text-muted] mt-2 p-3 rounded-lg bg-[--color-surface-elevated] border border-[--color-border] leading-relaxed">
          {children}
        </div>
      )}
    </>
  );
}
